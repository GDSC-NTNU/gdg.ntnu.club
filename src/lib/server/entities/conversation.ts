import type { ConversationDoc } from '../firebase/schema';
import { FirestoreService } from '../firebase/service';

export class Conversation {
	envId: string;
	convId: string;
	messages: ConversationDoc['messages'];
	static firestore = new FirestoreService();

	constructor(envId: string, convId: string, doc: ConversationDoc) {
		this.envId = envId;
		this.convId = convId;
		this.messages = doc.messages || [];
	}
	static async fetch(envId: string, convId: string): Promise<Conversation> {
		const doc = await Conversation.firestore.getDocument<ConversationDoc>(
			`environment/${envId}/conversations/${convId}`
		);
		return new Conversation(envId, convId, doc);
	}
	async save(): Promise<void> {
		await Conversation.firestore.setDocument(
			`environment/${this.envId}/conversations/${this.convId}`,
			{ messages: this.messages }
		);
	}
	addMessage(role: string, content: string, timestamp: Date) {
		this.messages.push({ role, content, timestamp });
	}
}
