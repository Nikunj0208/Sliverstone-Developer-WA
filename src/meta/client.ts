import axios, { type AxiosInstance } from "axios";

import { env } from "../config/env.js";

export function createMetaClient(): AxiosInstance {
  const baseURL = env.metaGraphApiVersion
    ? `https://graph.facebook.com/${env.metaGraphApiVersion}`
    : "https://graph.facebook.com";

  return axios.create({
    baseURL,
    headers: env.metaAccessToken
      ? { Authorization: `Bearer ${env.metaAccessToken}` }
      : undefined,
    timeout: 10_000
  });
}
