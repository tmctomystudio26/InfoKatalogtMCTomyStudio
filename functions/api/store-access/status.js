import { handleStatusRequest } from '../../_lib/store-vault-core.js';

export async function onRequestGet({ request, env }) {
  return handleStatusRequest(request, env);
}
