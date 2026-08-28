"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirebaseConfig } from "./config";

export function getFirebaseClientApp() {
  return getApps().length ? getApp() : initializeApp(getFirebaseConfig());
}

export function getFirebaseClientAuth() {
  return getAuth(getFirebaseClientApp());
}
