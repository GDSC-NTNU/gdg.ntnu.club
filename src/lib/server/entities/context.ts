import type { ContextDoc } from '../firebase/schema';
import { FirestoreService } from '../firebase/service';

export class Context {
	id: string;
	content: string;
	startAt: Date;
	endAt: Date;
	static firestore = new FirestoreService();

	constructor(id: string, doc: ContextDoc) {
		this.id = id;
		this.content = doc.content;
		this.startAt = new Date(doc.startAt);
		this.endAt = new Date(doc.endAt);
	}
	static async fetch(id: string): Promise<Context> {
		const doc = await Context.firestore.getDocumentWithCache<ContextDoc>(`context/${id}`);
		return new Context(id, doc);
	}
	isActive(now: Date = new Date()): boolean {
		return now >= this.startAt && now <= this.endAt;
	}
}
