use anyhow::{Result, anyhow};
use lib0::decoding::{Cursor, Read};
use lib0::encoding::Write;
use yrs::{Doc, ReadTxn, StateVector, Transact, Update};
use yrs::updates::decoder::Decode;
use yrs::updates::encoder::Encode;

/// Sync protocol message types
#[repr(u8)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SyncMessageType {
    SyncStep1 = 0,
    SyncStep2 = 1,
    Update = 2,
}

/// Handle sync protocol messages
pub struct SyncProtocol;

impl SyncProtocol {
    /// Read a sync message from the cursor and generate appropriate response
    pub fn read_sync_message(
        cursor: &mut Cursor,
        response_data: &mut Vec<u8>,
        doc: &Doc,
    ) -> Result<SyncMessageType> {
        // Read message type as varuint (Y.js uses varuint encoding)
        let message_type = cursor.read_var::<u64>()?;
        tracing::debug!("Sync message type: {} (0x{:x})", message_type, message_type);
        
        match message_type {
            0 => {
                // Sync step 1: Client sends their state vector
                let sv_data = cursor.read_buf()?;
                let client_state_vector = StateVector::decode_v1(sv_data)?;
                
                // Generate sync step 2: Send missing updates to client
                let txn = doc.transact();
                let update = txn.encode_state_as_update_v1(&client_state_vector);
                
                if !update.is_empty() {
                    response_data.write_var(SyncMessageType::SyncStep2 as u64);
                    response_data.write_buf(&update);
                }
                
                Ok(SyncMessageType::SyncStep1)
            }
            1 => {
                // Sync step 2: Client sends missing updates
                let update_data = cursor.read_buf()?;
                let update = Update::decode_v1(update_data)?;
                doc.transact_mut().apply_update(update);
                
                Ok(SyncMessageType::SyncStep2)
            }
            2 => {
                // Update: Regular document update
                let update_data = cursor.read_buf()?;
                let update = Update::decode_v1(update_data)?;
                doc.transact_mut().apply_update(update);
                
                Ok(SyncMessageType::Update)
            }
            _ => {
                Err(anyhow!("Unknown sync message type: {} (decimal), 0x{:x} (hex)", 
                    message_type, message_type))
            }
        }
    }
    
    /// Write sync step 1 message
    pub fn write_sync_step1(data: &mut Vec<u8>, doc: &Doc) -> Result<()> {
        data.write_var(SyncMessageType::SyncStep1 as u64);
        let state_vector = doc.transact().state_vector();
        let sv_encoded = state_vector.encode_v1();
        data.write_buf(&sv_encoded);
        Ok(())
    }
    
    /// Write sync step 2 message
    pub fn write_sync_step2(data: &mut Vec<u8>, doc: &Doc, client_state: &StateVector) -> Result<()> {
        let txn = doc.transact();
        let update = txn.encode_state_as_update_v1(client_state);
        
        if !update.is_empty() {
            data.write_var(SyncMessageType::SyncStep2 as u64);
            data.write_buf(&update);
        }
        Ok(())
    }
    
    /// Write update message
    pub fn write_update(data: &mut Vec<u8>, update: &[u8]) -> Result<()> {
        data.write_var(SyncMessageType::Update as u64);
        data.write_buf(update);
        Ok(())
    }
}