import { Environment } from '$lib/server/entities/environment';
import { redirect } from '@sveltejs/kit';

export const load = async ({ params }) => {
	const { envId } = params;
	try {
		const env = await Environment.fetch(envId);
		return {
			name: env.name
		};
	} catch {
		throw redirect(302, '/');
	}
};
