export interface EnvironmentDoc {
	name: string;
	task: string;
	startAt: Date;
	endAt: Date;
	context: string[];
}

export interface ContextDoc {
	content: string;
	startAt: Date;
	endAt: Date;
}

export interface ConversationDoc {
	messages: Array<{
		role: string;
		content: string;
		timestamp: Date;
	}>;
}
