import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getAccessToken } from 'web-auth-library/google';
import { cache } from './cache';

const FIRESTORE_SCOPES = ['https://www.googleapis.com/auth/datastore'];
const PROJECT_ID = env.GOOGLE_FIREBASE_PROJECT_ID;
const GOOGLE_FIREBASE_CREDENTIALS_JSON = env.GOOGLE_FIREBASE_CREDENTIALS_JSON;

export class FirestoreService {
	private credentials: string;
	constructor() {
		if (!GOOGLE_FIREBASE_CREDENTIALS_JSON && !building)
			throw new Error('Missing GOOGLE_FIREBASE_CREDENTIALS_JSON');
		this.credentials = GOOGLE_FIREBASE_CREDENTIALS_JSON || '';
	}
	private async getAccessToken(): Promise<string> {
		const token = await getAccessToken({ credentials: this.credentials, scope: FIRESTORE_SCOPES });
		if (!token) throw new Error('Failed to retrieve access token');
		return token;
	}
	async getDocument<T = unknown>(path: string, useCache = true): Promise<T> {
		if (useCache) {
			const cached = cache.get(path);
			if (cached) return cached as T;
		}
		const token = await this.getAccessToken();
		const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json'
			}
		});
		if (!response.ok)
			throw new Error(`Firestore API error (${response.status}): ${await response.text()}`);
		const document = await response.json();
		if (!document.fields) throw new Error('Document does not contain fields');
		const data = FirestoreService.convertFromFirestoreValue(document.fields);
		if (useCache) cache.set(path, data);
		return data as T;
	}
	async getDocumentWithCache<T = unknown>(path: string): Promise<T> {
		const cachedDoc = cache.get(path);
		if (cachedDoc) {
			return cachedDoc as T;
		}
		const doc = await this.getDocument<T>(path);
		cache.set(path, doc);
		return doc;
	}
	async setDocument<T = unknown>(path: string, data: T): Promise<void> {
		const token = await this.getAccessToken();
		const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
		const firestoreFormattedData = FirestoreService.convertToFirestoreValue(data);
		const response = await fetch(url, {
			method: 'PATCH',
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ fields: firestoreFormattedData })
		});
		if (!response.ok)
			throw new Error(`Firestore API error (${response.status}): ${await response.text()}`);
		cache.delete(path);
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static convertToFirestoreValue(obj: any): any {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const fields: Record<string, any> = {};
		for (const key in obj as Record<string, unknown>) {
			const value = (obj as Record<string, unknown>)[key];
			if (typeof value === 'string') fields[key] = { stringValue: value };
			else if (typeof value === 'number')
				fields[key] = Number.isInteger(value)
					? { integerValue: String(value) }
					: { doubleValue: value };
			else if (typeof value === 'boolean') fields[key] = { booleanValue: value };
			else if (value === null) fields[key] = { nullValue: null };
			else if (value instanceof Date) fields[key] = { timestampValue: value.toISOString() };
			else if (Array.isArray(value))
				fields[key] = {
					arrayValue: {
						values: value.map(
							(item) => FirestoreService.convertToFirestoreValue({ temp: item })['temp']
						)
					}
				};
			else if (typeof value === 'object' && value !== null)
				fields[key] = { mapValue: { fields: FirestoreService.convertToFirestoreValue(value) } };
		}
		return fields;
	}
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	static convertFromFirestoreValue(fields: any): any {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const map = fields as Record<string, any>;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const obj: Record<string, any> = {};
		for (const key in map) {
			const valueData = map[key];
			const valueType = Object.keys(valueData)[0];
			switch (valueType) {
				case 'stringValue':
					obj[key] = valueData.stringValue;
					break;
				case 'integerValue':
					obj[key] = parseInt(valueData.integerValue, 10);
					break;
				case 'doubleValue':
					obj[key] = valueData.doubleValue;
					break;
				case 'booleanValue':
					obj[key] = valueData.booleanValue;
					break;
				case 'nullValue':
					obj[key] = null;
					break;
				case 'timestampValue':
					obj[key] = new Date(valueData.timestampValue);
					break;
				case 'arrayValue':
					obj[key] = valueData.arrayValue.values
						? valueData.arrayValue.values.map(
								// eslint-disable-next-line @typescript-eslint/no-explicit-any
								(item: any) => FirestoreService.convertFromFirestoreValue({ temp: item })['temp']
							)
						: [];
					break;
				case 'mapValue':
					obj[key] = FirestoreService.convertFromFirestoreValue(valueData.mapValue.fields || {});
					break;
				default:
					obj[key] = valueData;
					break;
			}
		}
		return obj;
	}
}
