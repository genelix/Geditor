use regex::RegexBuilder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize)]
pub struct SearchMatch {
    pub file_path: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[tauri::command]
pub fn search_in_files(
    root_path: String,
    query: String,
    is_regex: bool,
    match_case: bool,
    max_results: Option<usize>,
) -> Result<Vec<SearchMatch>, String> {
    if query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let max = max_results.unwrap_or(200);
    let mut results = Vec::new();

    let pattern = if is_regex {
        query
    } else {
        regex::escape(&query)
    };

    let re = RegexBuilder::new(&pattern)
        .case_insensitive(!match_case)
        .build()
        .map_err(|e| format!("Invalid regex pattern: {}", e))?;

    let root = Path::new(&root_path);
    if !root.exists() {
        return Err("Root path does not exist".to_string());
    }

    for entry in WalkDir::new(root)
        .max_depth(10)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !name.starts_with('.') && name != "node_modules" && name != "target" && name != "dist"
        })
        .flatten()
    {
        if results.len() >= max {
            break;
        }

        if entry.file_type().is_file() {
            let path = entry.path();
            // Skip large binary files or files > 5MB
            if let Ok(metadata) = entry.metadata() {
                if metadata.len() > 5 * 1024 * 1024 {
                    continue;
                }
            }

            if let Ok(content) = fs::read_to_string(path) {
                let file_name = path
                    .file_name()
                    .map(|s| s.to_string_lossy().to_string())
                    .unwrap_or_default();
                let file_path = path.to_string_lossy().to_string();

                for (idx, line) in content.lines().enumerate() {
                    if results.len() >= max {
                        break;
                    }
                    if let Some(m) = re.find(line) {
                        results.push(SearchMatch {
                            file_path: file_path.clone(),
                            file_name: file_name.clone(),
                            line_number: idx + 1,
                            line_content: line.trim_end().to_string(),
                            match_start: m.start(),
                            match_end: m.end(),
                        });
                    }
                }
            }
        }
    }

    Ok(results)
}
