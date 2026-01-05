use serde::{Deserialize, Serialize};

/// 自定义反序列化器：兼容字符串或整数格式的时间戳
mod timestamp_flexible {
    use serde::{Deserialize, Deserializer};

    pub fn deserialize<'de, D>(deserializer: D) -> Result<Option<i64>, D::Error>
    where
        D: Deserializer<'de>,
    {
        #[derive(Deserialize)]
        #[serde(untagged)]
        enum StringOrInt {
            String(String),
            Int(i64),
        }

        let opt: Option<StringOrInt> = Option::deserialize(deserializer)?;
        match opt {
            Some(StringOrInt::String(s)) => s
                .parse::<i64>()
                .map(Some)
                .map_err(serde::de::Error::custom),
            Some(StringOrInt::Int(i)) => Ok(Some(i)),
            None => Ok(None),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PageParam {
    pub current: u32,
    pub size: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorPageParam {
    pub page_size: u32,
    pub cursor: String,
    pub create_id: Option<String>,
    pub create_time: Option<i64>,
    pub update_time: Option<i64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CursorPageResp<T> {
    pub cursor: String,
    pub is_last: bool,
    pub list: Option<T>,
    pub total: u64,
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginParam {
    pub account: String,
    pub password: String,
    pub source: String,
}

#[derive(Deserialize, Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ApiResult<T> {
    pub success: bool,
    pub code: Option<i32>,
    pub msg: Option<String>,
    pub version: Option<String>,
    pub data: Option<T>,
    // 兼容后端返回的额外字段
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default, deserialize_with = "timestamp_flexible::deserialize")]
    pub timestamp: Option<i64>,
}

#[derive(serde::Deserialize, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub records: Vec<T>,
    pub total: String,
    pub size: String,
}

/// HTTP 错误响应结构（Spring Boot 默认错误格式）
#[derive(Deserialize, Debug)]
pub struct HttpErrorResponse {
    pub timestamp: Option<String>,
    pub status: Option<i32>,
    pub error: Option<String>,
    pub message: Option<String>,
    pub path: Option<String>,
}

impl HttpErrorResponse {
    /// 获取错误消息
    pub fn get_message(&self) -> String {
        self.message
            .clone()
            .or_else(|| self.error.clone())
            .unwrap_or_else(|| format!("HTTP Error {}", self.status.unwrap_or(500)))
    }
}

#[derive(serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LoginResp {
    pub uuid: Option<String>,
    pub token: String,
    pub refresh_token: String,
    pub client: String,
}
