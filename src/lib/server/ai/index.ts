import { env } from '$env/dynamic/private';
import { OpenAI } from 'openai';

let openai: OpenAI | null = null;

export function getOpenAI() {
	if (openai) {
		return openai;
	}

	openai = new OpenAI({
		apiKey: env.OPENAI_API_KEY,
		baseURL: env.OPENAI_API_BASE_URL,
		maxRetries: 5
	});
	return openai;
}

export const OPENAI_MODEL = env.OPENAI_MODEL || 'gemini-2.0-flash';
