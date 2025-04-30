import { redirect } from '@sveltejs/kit';

export const load = async () => {
	throw redirect(
		307,
		'https://gdg.community.dev/gdg-on-campus-national-taiwan-normal-university-taipei-taiwan/'
	);
};
