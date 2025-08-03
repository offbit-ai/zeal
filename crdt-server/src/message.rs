use serde::{Deserialize, Serialize};

/// Message types for CRDT communication
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MessageType {
    Sync = 0,
    Awareness = 1,
    Auth = 2,
    QueryAwareness = 3,
    Custom = 4,
}

impl TryFrom<u8> for MessageType {
    type Error = anyhow::Error;

    fn try_from(value: u8) -> Result<Self, Self::Error> {
        match value {
            0 => Ok(MessageType::Sync),
            1 => Ok(MessageType::Awareness),
            2 => Ok(MessageType::Auth),
            3 => Ok(MessageType::QueryAwareness),
            4 => Ok(MessageType::Custom),
            _ => Err(anyhow::anyhow!("Invalid message type: {}", value)),
        }
    }
}

#[derive(Debug, Clone)]
pub struct CRDTMessage {
    pub message_type: MessageType,
    pub data: Vec<u8>,
    pub sender_id: String,
    pub room_name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthData {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "userName")]
    pub user_name: String,
    #[serde(rename = "userColor")]
    pub user_color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserInfo {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinedResponse {
    #[serde(rename = "roomName")]
    pub room_name: String,
    #[serde(rename = "clientId")]
    pub client_id: String,
}

/// Generate a color for a user based on their ID
pub fn generate_user_color(user_id: &str) -> String {
    let colors = [
        "#ef4444", "#f59e0b", "#10b981", "#3b82f6",
        "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
    ];
    
    let mut hash: u32 = 0;
    for byte in user_id.bytes() {
        hash = hash.wrapping_mul(31).wrapping_add(byte as u32);
    }
    
    colors[(hash as usize) % colors.len()].to_string()
}