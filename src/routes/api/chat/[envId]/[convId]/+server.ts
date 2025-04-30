import { getOpenAI, OPENAI_MODEL } from '$lib/server/ai';
import { Conversation } from '$lib/server/entities/conversation';
import { Environment } from '$lib/server/entities/environment';
import type { OpenAI } from 'openai';
import { produce } from 'sveltekit-sse';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const InputSchema = z.object({ message: z.string().min(1).max(1000) });

export const POST: RequestHandler = async ({ request, params }) => {
	const { envId, convId } = params;
	const { message } = InputSchema.parse(await request.json());

	// Fetch environment and its active contexts
	const env = await Environment.fetch(envId);
	const activeContexts = await env.getActiveContexts();

	// Build system prompt with environment task and active contexts
	const systemPromptParts = [
		`Task: ${env.task}`,
		...activeContexts.map((content, idx) => `Context ${idx + 1}:\n${content}`)
	];
	const systemPrompt = systemPromptParts.join('\n\n');

	// Load existing conversation
	const conversation = await Conversation.fetch(envId, convId);
	const timestamp = new Date();
	conversation.addMessage('user', message, timestamp);

	// Prepare full messages for LLM
	const llmMessages = [
		{ role: 'system', content: systemPrompt },
		...conversation.messages.map((m) => ({ role: m.role, content: m.content }))
	];

	// Generate response from model (streaming)
	const openai = getOpenAI();
	let aiContent = '';

	return produce(async (c) => {
		try {
			const stream = await openai.chat.completions.create({
				model: OPENAI_MODEL,
				messages: [
					...llmMessages,
					{ role: 'user', content: message }
				] as OpenAI.ChatCompletionMessageParam[],
				stream: true
			});
			for await (const chunk of stream) {
				const delta = chunk.choices?.[0]?.delta?.content;
				if (delta) {
					aiContent += delta;
					c.emit('message', JSON.stringify({ content: delta }));
				}
			}
		} catch (error) {
			console.error('Error generating response:', error);
			c.emit('error', JSON.stringify({ error: 'Failed to generate response' }));
			c.lock.set(false);
			return;
		}

		conversation.addMessage('assistant', aiContent, timestamp);
		await conversation.save();
		c.lock.set(false);
	});
};
