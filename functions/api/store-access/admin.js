import { handleAdminRequest } from '../../_lib/store-vault-core.js';

export async function onRequestGet({ request, env }) {
  return handleAdminRequest(request, env);
}

export async function onRequestPost({ request, env }) {
  return handleAdminRequest(request, env);
}
