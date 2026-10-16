import { useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Callout, Checkbox, Icon, Input, cx } from "@rootpanther/ui";
import type { Provider } from "@rootpanther/ui";
import { AuthHeader, AuthLayout } from "./AuthLayout";
import { OrDivider, PasswordField, ProviderButtons, StrengthMeter } from "./parts";
import { checkPassword, emailError, personalTokens } from "./password";

const TAKEN_EMAIL = "dana.reyes@example.com";

type Errors = Partial<Record<"name" | "email" | "password" | "terms", string>>;

export default function SignUpPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState(params.get("state") === "error" ? TAKEN_EMAIL : "");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [taken, setTaken] = useState(params.get("state") === "error");
  const [busy, setBusy] = useState(false);
  const [provider, setProvider] = useState<Provider | null>(null);
  const refs = {
    name: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
    terms: useRef<HTMLInputElement>(null),
  };

  const check = useMemo(() => checkPassword(password, personalTokens(name, email.split("@")[0])), [password, name, email]);

  const errors: Errors = {
    name: name.trim().length < 2 ? (name.trim() ? "Enter at least 2 characters" : "Enter your name") : undefined,
    email: emailError(email) ?? (taken && email.trim().toLowerCase() === TAKEN_EMAIL ? "An account already uses this email" : undefined),
    password: !password ? "Create a password" : !check.valid ? "Meet every requirement below" : undefined,
    terms: terms ? undefined : "Accept the Terms and the Privacy policy to continue",
  };
  const show = (k: keyof Errors) => ((submitted || touched[k]) && errors[k]) || undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    const first = (Object.keys(refs) as (keyof Errors)[]).find((k) => errors[k]);
    if (first) return refs[first].current?.focus();
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (email.trim().toLowerCase() === TAKEN_EMAIL) {
        setTaken(true);
        refs.email.current?.focus();
        return;
      }
      navigate(`/verify?email=${encodeURIComponent(email.trim())}`);
    }, 1000);
  }

  function onProvider(p: Provider) {
    setProvider(p);
    window.setTimeout(() => navigate("/onboarding"), 1100);
  }

  const blur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const emailTaken = errors.email === "An account already uses this email";

  return (
    <AuthLayout>
      <div className="au-card__body rp-view">
        <AuthHeader title="Create your account" />
        <form className="au-form" method="post" action="/signup" noValidate onSubmit={onSubmit} aria-label="Create account">
          <Input
            ref={refs.name}
            label="Name"
            name="name"
            inputSize="lg"
            autoComplete="name"
            value={name}
            maxLength={80}
            error={show("name")}
            onChange={(e) => setName(e.target.value)}
            onBlur={blur("name")}
          />
          <Input
            ref={refs.email}
            label="Email"
            type="email"
            name="email"
            inputSize="lg"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            error={show("email") ?? (emailTaken ? errors.email : undefined)}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={blur("email")}
          />
          {emailTaken && (
            <Callout tone="info" icon="user">
              <Link to="/signin">Sign in</Link> instead, or <Link to="/reset">reset the password</Link> if you no longer have it.
            </Callout>
          )}
          <div className="au-stack au-stack--tight">
            <PasswordField
              ref={refs.password}
              label="Password"
              name="new-password"
              inputSize="lg"
              autoComplete="new-password"
              value={password}
              describedBy="su-strength"
              error={submitted && !check.valid ? errors.password : undefined}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={blur("password")}
            />
            <StrengthMeter check={check} id="su-strength" empty={!password} showErrors={password.length > 0 && (submitted || touched.password)} />
          </div>
          <div className={cx("au-terms", show("terms") && "is-invalid")}>
            <Checkbox
              ref={refs.terms}
              name="terms"
              checked={terms}
              aria-invalid={show("terms") ? true : undefined}
              aria-describedby={show("terms") ? "su-terms-error" : undefined}
              onChange={(e) => setTerms(e.target.checked)}
              label={
                <>
                  I accept the{" "}
                  <a href="https://rootpanther.com/terms" target="_blank" rel="noopener noreferrer">
                    Terms
                  </a>{" "}
                  and the{" "}
                  <a href="https://rootpanther.com/privacy" target="_blank" rel="noopener noreferrer">
                    Privacy policy
                  </a>
                </>
              }
            />
            {show("terms") && (
              <p className="rp-field__error" id="su-terms-error" role="alert">
                <Icon name="alert-circle" size={13} />
                {errors.terms}
              </p>
            )}
          </div>
          <Button type="submit" variant="primary" size="lg" block loading={busy} disabled={provider !== null} className="au-form__submit">
            {busy ? "Creating account" : "Create account"}
          </Button>
        </form>
        <OrDivider />
        <ProviderButtons onSelect={onProvider} pending={provider} />
      </div>
      <div className="au-card__foot">
        <span>Already have an account?</span>
        <Link to="/signin">Sign in</Link>
      </div>
    </AuthLayout>
  );
}
