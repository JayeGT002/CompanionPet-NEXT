use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Option<Vec<Choice>>,
}

#[derive(Deserialize)]
struct Choice {
    message: Option<ChatMessage>,
}

#[derive(Deserialize)]
struct ChatMessage {
    content: Option<String>,
}

const LLM_PROMPT: &str = "你是一个桌面宠物的台词生成器。请生成10条简短的中文日常对话台词，每行一条，语气温柔可爱。直接输出台词，不要编号和解释。";

/// 调用 LLM 生成兜底发言
pub async fn generate_speeches(endpoint: &str, api_key: &str, model: &str) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let body = ChatRequest {
        model: model.to_string(),
        messages: vec![Message {
            role: "user".to_string(),
            content: LLM_PROMPT.to_string(),
        }],
        max_tokens: 500,
        temperature: 0.9,
    };

    let res = client
        .post(endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    if !res.status().is_success() {
        return Err(format!("HTTP {}", res.status()));
    }

    let data: ChatResponse = res.json().await.map_err(|e| format!("解析失败: {}", e))?;
    let content = data
        .choices
        .and_then(|c| c.into_iter().next())
        .and_then(|c| c.message)
        .and_then(|m| m.content)
        .unwrap_or_default();

    let lines: Vec<String> = content
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && l.len() < 60)
        .collect();

    if lines.is_empty() {
        Err("LLM 返回内容为空".into())
    } else {
        Ok(lines)
    }
}
