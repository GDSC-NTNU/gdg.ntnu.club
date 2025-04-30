import { getOpenAI, OPENAI_MODEL } from '$lib/server/ai';
import { Conversation } from '$lib/server/entities/conversation';
import { Environment } from '$lib/server/entities/environment';
import { randomUUID } from 'node:crypto';
import type { OpenAI } from 'openai';
import { produce } from 'sveltekit-sse';
import { z } from 'zod';
import type { RequestHandler } from './$types';

const InputSchema = z.object({ message: z.string().min(1).max(1000) });

export const POST: RequestHandler = async ({ request, params }) => {
	const { envId } = params;
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

	// Prepare messages for the LLM
	const messages = [
		{ role: 'system', content: systemPrompt },
		{ role: 'user', content: message }
	];

	// Generate response from model
	const openai = getOpenAI();
	let aiContent = '';

	return produce(async (c) => {
		try {
			const stream = await openai.chat.completions.create({
				model: OPENAI_MODEL,
				messages: messages as OpenAI.ChatCompletionMessageParam[],
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
		const convId = randomUUID();
		const conversation = new Conversation(envId, convId, { messages: [] });
		const timestamp = new Date();
		conversation.addMessage('user', message, timestamp);
		conversation.addMessage('assistant', aiContent, timestamp);
		await conversation.save();
		c.lock.set(false);
	});
};
