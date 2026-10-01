#![cfg(test)]

use super::parse_human_list;

const SAMPLE: &str = "\
Settings:

[appearance]
  theme.dark = titanium (string)
  symbolPreset = unicode (unicode|nerd|ascii)
  colorBlindMode = false (boolean)
  workspace.additionalDirectories = [] (array)

[memory]
  memory.backend = off (off|local|hindsight|mnemopi|sharpshooter)
  hindsight.apiUrl = http://localhost:8888 (string)

[tools]
  tools.approvalMode = yolo (always-ask|write|yolo)
";

#[test]
fn parses_tabs_in_first_seen_order() {
    let (tabs, _) = parse_human_list(SAMPLE);
    assert_eq!(tabs, vec!["appearance", "memory", "tools"]);
}

#[test]
fn scalar_type_annotation_is_not_an_enum() {
    let (_, map) = parse_human_list(SAMPLE);
    let (tab, options) = map.get("theme.dark").unwrap();
    assert_eq!(tab, "appearance");
    assert!(options.is_none());
}

#[test]
fn pipe_list_becomes_options() {
    let (_, map) = parse_human_list(SAMPLE);
    let (_, options) = map.get("symbolPreset").unwrap();
    assert_eq!(
        options.as_ref().unwrap(),
        &vec!["unicode".to_string(), "nerd".to_string(), "ascii".to_string()]
    );
}

#[test]
fn array_and_record_annotations_are_types_not_options() {
    let (_, map) = parse_human_list(SAMPLE);
    let (_, options) = map.get("workspace.additionalDirectories").unwrap();
    assert!(options.is_none());
}

#[test]
fn values_containing_parentheses_round_trip() {
    let (_, map) = parse_human_list(SAMPLE);
    let (tab, options) = map.get("hindsight.apiUrl").unwrap();
    assert_eq!(tab, "memory");
    assert!(options.is_none());
}

#[test]
fn every_entry_gets_its_section_tab() {
    let (_, map) = parse_human_list(SAMPLE);
    assert_eq!(map.get("tools.approvalMode").unwrap().0, "tools");
    assert_eq!(map.get("memory.backend").unwrap().0, "memory");
}
