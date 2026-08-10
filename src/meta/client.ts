import axios, { type AxiosInstance } from "axios";

import { env } from "../config/env.js";

export function createMetaClient(): AxiosInstance {
  return axios.create({
    baseURL: `https://graph.facebook.com/${env.metaGraphApiVersion}`,
    headers: {
      Authorization: `Bearer ${env.metaAccessToken}`,
      "Content-Type": "application/json"
    },
    timeout: 10_000
  });
}
