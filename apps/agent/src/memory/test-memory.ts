/**
 * Test script for memory adapter
 * Run this to verify the memory system works with the database
 */

import { createMemoryService } from './index';

async function testMemoryAdapter() {
  // Use local Supabase connection
  const memoryService = createMemoryService(
    'postgresql://postgres:postgres@127.0.0.1:55322/postgres'
  );

  console.log('🧠 Testing Memory Adapter...');

  try {
    // 1. Test workspace retrieval
    console.log('\n1. Getting default workspace...');
    const workspaces = await memoryService.memory.getWorkspaces();
    console.log('Workspaces found:', workspaces.length);
    console.log('Default workspace:', workspaces[0]?.name);

    // 2. Test thread creation
    console.log('\n2. Creating conversation thread...');
    const threadId = await memoryService.startAgentConversation({
      agentId: 'calendar-assistant',
      userId: 'test-user',
      title: 'Test Conversation',
    });
    console.log('Thread created:', threadId);

    // 3. Test adding messages
    console.log('\n3. Adding messages...');
    await memoryService.addMessage({
      threadId,
      role: 'user',
      content: 'Hello, can you help me with my calendar?',
    });

    await memoryService.addMessage({
      threadId,
      role: 'assistant',
      content: 'Of course! I can help you manage your calendar. What would you like to do?',
    });

    // 4. Test conversation history
    console.log('\n4. Getting conversation history...');
    const history = await memoryService.getConversationHistory(threadId);
    console.log('Messages in conversation:', history.length);
    history.forEach((msg, i) => {
      console.log(`  ${i + 1}. ${msg.role}: ${msg.content}`);
    });

    // 5. Test working memory
    console.log('\n5. Testing working memory...');
    await memoryService.setWorkingMemory({
      threadId,
      key: 'user_timezone',
      value: 'America/New_York',
    });

    await memoryService.setWorkingMemory({
      threadId,
      key: 'user_preferences',
      value: { defaultView: 'week', startTime: '09:00' },
    });

    const workingMemory = await memoryService.getWorkingMemory({ threadId });
    console.log('Working memory:', workingMemory);

    // 6. Test directives
    console.log('\n6. Testing agent directives...');
    await memoryService.setAgentDirective({
      agentId: 'calendar-assistant',
      key: 'tone',
      value: 'friendly and professional',
    });

    await memoryService.setAgentDirective({
      agentId: 'calendar-assistant',
      key: 'default_duration',
      value: 30,
    });

    const directives = await memoryService.getAgentDirectives({
      agentId: 'calendar-assistant',
    });
    console.log('Agent directives:', directives);

    // 7. Test full context building
    console.log('\n7. Building complete agent context...');
    const context = await memoryService.buildAgentContext({
      threadId,
      agentId: 'calendar-assistant',
      userId: 'test-user',
    });

    console.log('Complete context:');
    console.log('  - Conversation history:', context.conversationHistory.length, 'messages');
    console.log('  - Directives:', Object.keys(context.directives));
    console.log('  - Working memory:', Object.keys(context.workingMemory));

    // 8. Test thread stats
    console.log('\n8. Getting thread statistics...');
    const stats = await memoryService.getThreadStats(threadId);
    console.log('Thread stats:', stats);

    console.log('\n✅ All memory adapter tests passed!');
  } catch (error) {
    console.error('\n❌ Memory adapter test failed:', error);
  } finally {
    await memoryService.disconnect();
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testMemoryAdapter();
}

export { testMemoryAdapter };
