import type { ContextDoc, EnvironmentDoc } from '../firebase/schema';
import { FirestoreService } from '../firebase/service';

export class Environment {
	id: string;
	name: string;
	task: string;
	startAt: Date;
	endAt: Date;
	context: string[];
	static firestore = new FirestoreService();

	constructor(id: string, doc: EnvironmentDoc) {
		this.id = id;
		this.name = doc.name;
		this.task = doc.task;
		this.startAt = new Date(doc.startAt);
		this.endAt = new Date(doc.endAt);
		this.context = doc.context || [];
	}
	static async fetch(id: string): Promise<Environment> {
		const doc = await Environment.firestore.getDocumentWithCache<EnvironmentDoc>(
			`environment/${id}`
		);
		return new Environment(id, doc);
	}
	async getActiveContexts(): Promise<string[]> {
		const now = new Date();
		const contextDocs = await Promise.all(
			this.context.map((id) =>
				Environment.firestore.getDocumentWithCache<ContextDoc>(`context/${id}`)
			)
		);
		return contextDocs
			.filter((doc) => {
				const start = new Date(doc.startAt);
				const end = new Date(doc.endAt);
				return now >= start && now <= end;
			})
			.map((doc) => doc.content);
	}
}
