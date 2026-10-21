#![cfg(test)]

use serde_json::json;

use super::*;

fn provider_sample() -> Provider {
    Provider {
        id: "axon".to_string(),
        base_url: "http://localhost:8090".to_string(),
        api: "anthropic-messages".to_string(),
        api_key: "k".to_string(),
        auth_none: false,
        disable_strict_tools: false,
        models: vec![
            ModelEntry {
                id: "m1".to_string(),
                name: Some("M One".to_string()),
                api: None,
                reasoning: true,
                image_input: true,
                context_window: Some(128000),
                max_tokens: Some(16384),
                thinking: Some(ThinkingConfig {
                    mode: "effort".into(),
                    efforts: vec!["low".into(), "high".into(), "max".into()],
                    default_level: Some("high".into()),
                    ..Default::default()
                }),
                raw: JValue::Null,
            },
            ModelEntry {
                id: "m2".to_string(),
                name: None,
                api: None,
                reasoning: false,
                image_input: false,
                context_window: None,
                max_tokens: None,
                thinking: None,
                raw: JValue::Null,
            },
        ],
        raw: JValue::Null,
    }
}

#[test]
fn to_value_round_trips_model_fields() {
    let p = provider_sample();
    let v = p.to_value().unwrap();
    let models = v.get("models").and_then(|m| m.as_array()).unwrap();
    let m1 = &models[0];
    assert_eq!(m1.get("reasoning"), Some(&json!(true)));
    assert_eq!(m1.get("input"), Some(&json!(["text", "image"])));
    assert_eq!(m1.get("contextWindow"), Some(&json!(128000)));
    assert_eq!(m1.get("maxTokens"), Some(&json!(16384)));
    assert_eq!(
        m1.get("thinking"),
        Some(&json!({
            "mode": "effort",
            "efforts": ["low", "high", "max"],
            "defaultLevel": "high"
        }))
    );

    let back = Provider::from_value("axon", &v);
    let b1 = &back.models[0];
    assert!(b1.reasoning);
    assert!(b1.image_input);
    assert_eq!(b1.context_window, Some(128000));
    assert_eq!(b1.max_tokens, Some(16384));
    let thinking = b1.thinking.as_ref().unwrap();
    assert_eq!(thinking.mode, "effort");
    assert_eq!(thinking.efforts, vec!["low", "high", "max"]);
    assert_eq!(thinking.default_level.as_deref(), Some("high"));
}

#[test]
fn to_value_omits_empty_model_fields() {
    let p = provider_sample();
    let v = p.to_value().unwrap();
    let models = v.get("models").and_then(|m| m.as_array()).unwrap();
    let m2 = &models[1];
    assert!(m2.get("reasoning").is_none());
    assert_eq!(m2.get("input"), Some(&json!(["text"])));
    assert!(m2.get("contextWindow").is_none());
    assert!(m2.get("maxTokens").is_none());
    assert!(m2.get("thinking").is_none());

    let back = Provider::from_value("axon", &v);
    assert!(back.models[1].thinking.is_none());
}

#[test]
fn parse_catalog_reads_thinking_and_image() {
    let out = r#"{"models":[{"provider":"axon","id":"m1","selector":"axon/m1","name":"M1","contextWindow":100,"maxTokens":10,"reasoning":true,"thinking":["low","high"],"input":["text","image"]}]}"#;
    let items = parse_catalog(out, Some("axon"));
    assert_eq!(items.len(), 1);
    assert_eq!(
        items[0].thinking,
        vec!["low".to_string(), "high".to_string()]
    );
    assert!(items[0].image_input);
}

#[test]
fn validate_rejects_unknown_api() {
    let mut p = provider_sample();
    p.api = "openai-chat".into();
    assert!(validate(&p).is_err());
    p.api = "openai-completions".into();
    assert!(validate(&p).is_ok());
}

#[test]
fn max_levels_merge_into_reasoning_models_only() {
    let plain = |id: &str| ModelEntry {
        id: id.to_string(),
        name: None,
        api: None,
        reasoning: true,
        image_input: false,
        context_window: None,
        max_tokens: None,
        thinking: None,
        raw: JValue::Null,
    };
    let mut p = Provider {
        id: "axon".to_string(),
        base_url: "http://localhost:8090".to_string(),
        api: "openai-completions".to_string(),
        api_key: "k".to_string(),
        auth_none: false,
        disable_strict_tools: false,
        models: vec![
            plain("from-catalog"),
            ModelEntry {
                thinking: Some(ThinkingConfig {
                    mode: "budget".into(),
                    efforts: vec!["minimal".into(), "high".into()],
                    default_level: Some("medium".into()),
                    extra: Map::from_iter([("supportsDisplay".to_string(), json!(true))]),
                    ..Default::default()
                }),
                ..plain("explicit")
            },
            ModelEntry {
                reasoning: false,
                ..plain("not-reasoning")
            },
        ],
        raw: JValue::Null,
    };
    let effective = HashMap::from([(
        "from-catalog".to_string(),
        vec!["low".to_string(), "high".to_string()],
    )]);
    merge_max_levels(&mut p, &effective);

    let catalog = p.models[0].thinking.as_ref().unwrap();
    assert_eq!(catalog.mode, "effort");
    assert_eq!(catalog.efforts, vec!["low", "high", "max"]);

    let explicit = p.models[1].thinking.as_ref().unwrap();
    assert_eq!(explicit.mode, "budget");
    assert_eq!(explicit.efforts, vec!["minimal", "high", "max"]);
    assert_eq!(explicit.default_level, None);
    assert_eq!(explicit.extra.get("supportsDisplay"), Some(&json!(true)));

    assert!(p.models[2].thinking.is_none());
}
