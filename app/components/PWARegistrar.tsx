"use client";

import { useEffect } from "react";

export default function PWARegistrar() {
  useEffect(() => {
    // We checken of we in de browser zijn en of de telefoon Service Workers ondersteunt
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").then(
          function (registration) {
            console.log("🛡️ PWA Service Worker succesvol geïnjecteerd:", registration.scope);
          },
          function (err) {
            console.error("⚠️ PWA Service Worker registratie mislukt:", err);
          }
        );
      });
    }
  }, []);

  return null; // Dit is een "spook" component, het rendert visueel niets op het scherm.
}