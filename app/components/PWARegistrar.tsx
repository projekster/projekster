"use client";

import { useEffect } from "react";

export default function PWARegistrar() {
  useEffect(() => {
    // We checken of we in de browser zijn en of de telefoon Service Workers ondersteunt
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("/sw.js").then(
          function (registration) {
            console.log("🛡️ PWA Service Worker succesvol geïnjecteerd (White Cube Ready):", registration.scope);
          },
          function (err) {
            console.error("⚠️ PWA Service Worker registratie mislukt:", err);
          }
        );
      });
    }
  }, []);

  // Dit is een "spook" component, de logica draait onzichtbaar op de achtergrond.
  return null; 
}