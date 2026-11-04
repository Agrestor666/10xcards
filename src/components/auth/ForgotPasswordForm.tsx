import React, { useEffect, useRef, useState } from "react";
import { Mail, Send } from "lucide-react";
import { FormField } from "@/components/auth/FormField";
import { SubmitButton } from "@/components/auth/SubmitButton";
import { ServerError } from "@/components/auth/ServerError";
import { TurnstileWidget } from "@/components/auth/TurnstileWidget";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { useLocale } from "@/components/i18n/useLocale";
import type { AppLocale } from "@/lib/locale";

interface Props {
  locale: AppLocale;
  serverError?: string | null;
  turnstileSiteKey?: string;
}

function formValue(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function ForgotPasswordFormInner({ serverError, turnstileSiteKey }: Omit<Props, "locale">) {
  const { locale, t } = useLocale();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<{ email?: string; captcha?: string }>({});

  useEffect(() => {
    formRef.current?.setAttribute("data-hydrated", "true");
  }, []);

  function validate(form: HTMLFormElement) {
    const fd = new FormData(form);
    const email = formValue(fd, "email").trim();
    const captchaToken = formValue(fd, "cf-turnstile-response").trim();

    const next: typeof errors = {};
    if (!email) {
      next.email = t("auth.validation.email_required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = t("auth.validation.email_invalid");
    }
    if (!captchaToken) {
      next.captcha = t("auth.validation.captcha_required");
    }
    return next;
  }

  function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    const next = validate(e.currentTarget);
    setErrors(next);
    if (Object.keys(next).length > 0) {
      e.preventDefault();
    }
  }

  return (
    <form
      ref={formRef}
      method="POST"
      action="/api/auth/forgot-password"
      className="space-y-4"
      onSubmit={handleSubmit}
      noValidate
    >
      <FormField
        id="email"
        type="email"
        label={t("auth.field.email")}
        theme="paper"
        uncontrolled
        onInput={() => {
          if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
        }}
        placeholder={t("auth.placeholder.email")}
        error={errors.email}
        icon={<Mail className="size-4" />}
      />

      <TurnstileWidget
        siteKey={turnstileSiteKey}
        locale={locale}
        error={errors.captcha}
        onTokenChange={(next) => {
          if (next.trim()) {
            setErrors((prev) => (prev.captcha ? { ...prev, captcha: undefined } : prev));
          }
        }}
      />

      <ServerError message={serverError} theme="paper" />

      <SubmitButton pendingText={t("auth.button.send_reset_link_pending")} icon={<Send className="size-4" />}>
        {t("auth.button.send_reset_link")}
      </SubmitButton>
    </form>
  );
}

export default function ForgotPasswordForm({ locale, serverError, turnstileSiteKey }: Props) {
  return (
    <LocaleProvider locale={locale}>
      <ForgotPasswordFormInner serverError={serverError} turnstileSiteKey={turnstileSiteKey} />
    </LocaleProvider>
  );
}
