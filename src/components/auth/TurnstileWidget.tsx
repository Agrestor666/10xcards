import { useEffect, useRef, useState } from "react";
import { CircleAlert } from "lucide-react";
import {
  TURNSTILE_DUMMY_SITE_KEY,
  TURNSTILE_DUMMY_TOKEN,
  TURNSTILE_RESPONSE_FIELD,
  TURNSTILE_SCRIPT_SRC,
} from "@/lib/turnstile-constants";
import type { AppLocale } from "@/lib/locale";

export interface TurnstileWidgetProps {
  siteKey?: string;
  locale: AppLocale;
  error?: string;
  onTokenChange?: (token: string) => void;
}

interface TurnstileRenderOptions {
  sitekey: string;
  theme: "light";
  size: "flexible";
  language: AppLocale;
  "response-field": false;
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string;
  remove: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      if (window.turnstile) {
        resolve();
        return;
      }
      existing.addEventListener(
        "load",
        () => {
          resolve();
        },
        { once: true },
      );
      existing.addEventListener(
        "error",
        () => {
          reject(new Error("Turnstile script failed to load"));
        },
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      "load",
      () => {
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => {
        reject(new Error("Turnstile script failed to load"));
      },
      { once: true },
    );
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({ siteKey, locale, error, onTokenChange }: TurnstileWidgetProps) {
  const isDummySiteKey = siteKey === TURNSTILE_DUMMY_SITE_KEY;
  const [token, setToken] = useState(isDummySiteKey ? TURNSTILE_DUMMY_TOKEN : "");
  const containerRef = useRef<HTMLDivElement>(null);
  const onTokenChangeRef = useRef(onTokenChange);

  useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!siteKey) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    let removed = false;
    let widgetId: string | undefined;

    const publish = (next: string) => {
      if (removed) {
        return;
      }
      setToken(next);
      onTokenChangeRef.current?.(next);
    };

    const renderWidget = () => {
      if (removed || !window.turnstile) {
        return;
      }
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: siteKey,
          theme: "light",
          size: "flexible",
          language: locale,
          "response-field": false,
          callback: (next) => {
            publish(next);
          },
          "expired-callback": () => {
            publish(isDummySiteKey ? TURNSTILE_DUMMY_TOKEN : "");
          },
          "error-callback": () => {
            publish(isDummySiteKey ? TURNSTILE_DUMMY_TOKEN : "");
          },
        });
      } catch {
        if (isDummySiteKey) {
          publish(TURNSTILE_DUMMY_TOKEN);
        }
      }
    };

    void loadTurnstileScript()
      .then(renderWidget)
      .catch(() => {
        if (isDummySiteKey) {
          publish(TURNSTILE_DUMMY_TOKEN);
        }
      });

    return () => {
      removed = true;
      if (widgetId) {
        window.turnstile?.remove(widgetId);
      }
    };
  }, [isDummySiteKey, locale, siteKey]);

  return (
    <div>
      <input type="hidden" name={TURNSTILE_RESPONSE_FIELD} value={token} />
      <div ref={containerRef} />
      {error ? (
        <p className="text-destructive mt-1 flex items-center gap-1 text-xs">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : null}
    </div>
  );
}
