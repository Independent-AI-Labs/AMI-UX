/**
 * ConversationManager - Unified conversation data model and logic
 */

export class ConversationManager {
    constructor(tileManager) {
        this.tileManager = tileManager;
        this.conversations = new Map(); // conversationId -> conversation object
        this.messageToConversation = new Map(); // messageId -> conversationId
        this.activeConversationId = null; // Currently locked conversation
    }

    // Create a new conversation at specified position
    createConversation(clickedQ, clickedR, messageId) {
        console.log(`Creating conversation at clicked position (${clickedQ}, ${clickedR})`);
        
        if (!this.tileManager) {
            console.error('TileManager not initialized');
            return {
                success: false,
                error: 'System not ready - please try again'
            };
        }
        
        // Check if the clicked position can start a conversation
        const conversationStartQ = Math.floor(clickedQ / 2) * 2; // Round down to even Q
        
        console.log(`Checking territory at conversation start (${conversationStartQ}, ${clickedR})`);
        console.log(`Left tile occupied: ${this.tileManager.isTileOccupied(conversationStartQ, clickedR)}`);
        console.log(`Right tile occupied: ${this.tileManager.isTileOccupied(conversationStartQ + 1, clickedR)}`);
        
        // Check if both columns have any existing conversation
        // Conversations occupy entire column pairs, so we need to check if these columns are already used
        let columnsOccupied = false;
        
        // Check if any existing conversation uses these columns
        for (let conversation of this.conversations.values()) {
            if (conversation.startQ === conversationStartQ) {
                console.log(`Columns ${conversationStartQ}-${conversationStartQ + 1} already occupied by conversation ${conversation.id}`);
                columnsOccupied = true;
                break;
            }
        }
        
        // Also check if the specific tiles are occupied
        if (!columnsOccupied && (this.tileManager.isTileOccupied(conversationStartQ, clickedR) || 
            this.tileManager.isTileOccupied(conversationStartQ + 1, clickedR))) {
            console.log(`Specific tiles at (${conversationStartQ}, ${clickedR}) or (${conversationStartQ + 1}, ${clickedR}) are occupied`);
            columnsOccupied = true;
        }
        
        if (columnsOccupied) {
            console.warn(`Cannot start conversation at (${clickedQ}, ${clickedR}) - territory occupied`);
            return {
                success: false,
                error: `Territory occupied. Cannot establish conversation at (${clickedQ}, ${clickedR}).`
            };
        }

        // Create conversation data
        const conversationId = `conv_${Date.now()}`;
        const conversation = {
            id: conversationId,
            startQ: conversationStartQ,
            startR: clickedR,
            messageIds: [messageId],
            createdAt: new Date()
        };

        // Store conversation
        this.conversations.set(conversationId, conversation);
        this.messageToConversation.set(messageId, conversationId);

        // Occupy the tile
        this.tileManager.occupyTile(conversationStartQ, clickedR, 'message', conversationId);

        console.log(`Created conversation ${conversationId} at (${conversationStartQ}, ${clickedR})`);
        
        return {
            success: true,
            conversationId,
            position: { q: conversationStartQ, r: clickedR }
        };
    }

    // Add a message to an existing conversation
    addMessageToConversation(conversationId, messageId) {
        const conversation = this.conversations.get(conversationId);
        if (!conversation) {
            console.error(`Conversation ${conversationId} not found`);
            return null;
        }

        // Calculate next message position
        const messageCount = conversation.messageIds.length;
        const isLeft = messageCount % 2 === 0;
        const rowOffset = Math.floor(messageCount / 2);
        
        const messageQ = conversation.startQ + (isLeft ? 0 : 1);
        const messageR = conversation.startR + rowOffset;

        // Check if position is available
        if (this.tileManager.isTileOccupied(messageQ, messageR)) {
            console.error(`Cannot place message at (${messageQ}, ${messageR}) - occupied`);
            return null;
        }

        // Add message to conversation
        conversation.messageIds.push(messageId);
        this.messageToConversation.set(messageId, conversationId);

        // Occupy the tile
        this.tileManager.occupyTile(messageQ, messageR, 'message', conversationId);

        console.log(`Added message ${messageId} to conversation ${conversationId} at (${messageQ}, ${messageR})`);

        return { q: messageQ, r: messageR };
    }

    // Lock to a conversation (for input tile display)
    lockToConversation(conversationId) {
        if (!this.conversations.has(conversationId)) {
            console.error(`Cannot lock to conversation ${conversationId} - not found`);
            return false;
        }

        this.activeConversationId = conversationId;
        console.log(`Locked to conversation ${conversationId}`);
        return true;
    }

    // Unlock current conversation
    unlock() {
        console.log(`Unlocked from conversation ${this.activeConversationId}`);
        this.activeConversationId = null;
    }

    // Get input position for active conversation
    getInputPosition() {
        console.log(`Getting input position - activeConversationId: ${this.activeConversationId}`);
        
        if (!this.activeConversationId) {
            console.log('No active conversation - returning fallback position');
            return { q: 0, r: 0 }; // Fallback
        }

        const conversation = this.conversations.get(this.activeConversationId);
        if (!conversation) {
            console.log(`Conversation ${this.activeConversationId} not found - returning fallback`);
            return { q: 0, r: 0 }; // Fallback
        }

        // Calculate next message position
        const messageCount = conversation.messageIds.length;
        const isLeft = messageCount % 2 === 0;
        const rowOffset = Math.floor(messageCount / 2);
        
        const inputPos = {
            q: conversation.startQ + (isLeft ? 0 : 1),
            r: conversation.startR + rowOffset
        };
        
        // console.log(`Calculated input position: (${inputPos.q}, ${inputPos.r}) for conversation with ${messageCount} messages`);
        return inputPos;
    }

    // Get conversation for a message
    getConversationForMessage(messageId) {
        const conversationId = this.messageToConversation.get(messageId);
        return conversationId ? this.conversations.get(conversationId) : null;
    }

    // Get position for a message (with fallback for legacy messages)
    getMessagePosition(message, index) {
        // If message has direct coordinates, use them
        if (message.q !== undefined && message.r !== undefined) {
            return { q: message.q, r: message.r };
        }

        // Check if message belongs to a tracked conversation
        const conversation = this.getConversationForMessage(message.id);
        if (conversation) {
            const messageIndex = conversation.messageIds.indexOf(message.id);
            if (messageIndex !== -1) {
                const isLeft = messageIndex % 2 === 0;
                const rowOffset = Math.floor(messageIndex / 2);
                return {
                    q: conversation.startQ + (isLeft ? 0 : 1),
                    r: conversation.startR + rowOffset
                };
            }
        }

        // Fallback for legacy messages (all in first conversation)
        const isLeft = index % 2 === 0;
        const rowInConversation = Math.floor(index / 2);
        
        return {
            q: isLeft ? 0 : 1,
            r: rowInConversation
        };
    }

    // Get active conversation ID
    getActiveConversationId() {
        return this.activeConversationId;
    }

    // Get active conversation start Q (for legacy compatibility)
    getActiveConversationQ() {
        if (!this.activeConversationId) return null;
        
        const conversation = this.conversations.get(this.activeConversationId);
        return conversation ? conversation.startQ : null;
    }
}

// Create singleton instance (will be initialized with tileManager later)
const conversationManager = new ConversationManager(null);
export default conversationManager;