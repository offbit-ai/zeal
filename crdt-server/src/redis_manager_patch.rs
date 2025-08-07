// Proposed changes to redis_manager.rs to make rooms persistent

// Change the save_room_state method to support optional TTL:
pub async fn save_room_state(&self, room_id: &str, state: &[u8]) -> Result<()> {
    if !self.enabled {
        return Ok(());
    }

    let mut conn = self.get_connection().await?;
    let key = format!("room:{}:state", room_id);
    
    // Check if room should be persistent (workflow rooms starting with "wf_")
    if room_id.starts_with("wf_") {
        // No TTL for workflow rooms - they persist forever
        redis::cmd("SET")
            .arg(&key)
            .arg(state)
            .query_async::<_, ()>(&mut conn)
            .await?;
    } else {
        // Temporary rooms get 24 hour TTL
        redis::cmd("SET")
            .arg(&key)
            .arg(state)
            .arg("EX")
            .arg(86400) // 24 hours TTL
            .query_async::<_, ()>(&mut conn)
            .await?;
    }
    
    Ok(())
}

// Add method to refresh room TTL (called from API):
pub async fn refresh_room_ttl(&self, room_id: &str) -> Result<()> {
    if !self.enabled {
        return Ok(());
    }

    let mut conn = self.get_connection().await?;
    let key = format!("room:{}:state", room_id);
    
    // Only refresh TTL for non-workflow rooms
    if !room_id.starts_with("wf_") {
        redis::cmd("EXPIRE")
            .arg(&key)
            .arg(86400) // Reset to 24 hours
            .query_async::<_, ()>(&mut conn)
            .await?;
    }
    
    Ok(())
}

// Change client session to be more lenient:
pub async fn save_client_session_with_ttl(&self, client_id: &str, session_data: &str, ttl_seconds: u64) -> Result<()> {
    if !self.enabled {
        return Ok(());
    }

    let mut conn = self.get_connection().await?;
    let key = format!("client:{}:session", client_id);
    
    // Use longer TTL for client sessions (7 days instead of 1 hour)
    let actual_ttl = if ttl_seconds < 604800 { 604800 } else { ttl_seconds };
    
    redis::cmd("SET")
        .arg(&key)
        .arg(session_data)
        .arg("EX")
        .arg(actual_ttl)
        .query_async::<_, ()>(&mut conn)
        .await?;
    
    Ok(())
}