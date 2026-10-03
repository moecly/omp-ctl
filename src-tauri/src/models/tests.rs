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
                thinking_level: Some("high".to_string()),
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
                thinking_level: None,
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
    assert_eq!(m1.get("thinkingLevelMap"), Some(&json!({ "high": null })));

    let back = Provider::from_value("axon", &v);
    let b1 = &back.models[0];
    assert!(b1.reasoning);
    assert!(b1.image_input);
    assert_eq!(b1.context_window, Some(128000));
    assert_eq!(b1.max_tokens, Some(16384));
    assert_eq!(b1.thinking_level.as_deref(), Some("high"));
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
    assert!(m2.get("thinkingLevelMap").is_none());

    let back = Provider::from_value("axon", &v);
    assert_eq!(back.models[1].thinking_level, None);
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
