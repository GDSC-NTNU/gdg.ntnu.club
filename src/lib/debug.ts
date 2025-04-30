import { dev } from '$app/environment';
import debug from 'debug';

export const log = debug('app');
log.enabled = dev;
