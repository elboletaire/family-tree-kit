/* Lock of the site: in the public version it opens the password dialog, and with the private data open it closes the
   session (session.ts) */
import { createSignal, onMount, Show } from 'solid-js';
import { texts } from '../i18n';
import { closeDialog, dialog, login, logout, openDialog, unlocked } from '../session';

/** Padlock, closed or open (the shackle lifted) */
function Padlock(props: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"
         stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d={props.open ? 'M8 11V7a4 4 0 0 1 7.5-2' : 'M8 11V7a4 4 0 0 1 8 0v4'} />
    </svg>
  );
}

export function LockButton() {
  const label = () => unlocked() ? texts.session.lock : texts.session.unlock;
  return (
    <button type="button" class="lock" classList={{ open: unlocked() }} id="lock" aria-label={label()} title={label()}
            onClick={() => unlocked() ? void logout() : openDialog()}>
      <Padlock open={unlocked()} />
    </button>
  );
}

function Form() {
  let input!: HTMLInputElement;
  const [error, setError] = createSignal(false);
  const [busy, setBusy] = createSignal(false);
  onMount(() => input.focus());
  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (busy()) return;
    setBusy(true);
    setError(false);
    const ok = await login(input.value);
    // On success the whole web is drawn again, this dialog closed
    if (!ok) { setBusy(false); setError(true); input.select(); }
  };
  return (
    <div class="modal" onClick={e => { if (e.target === e.currentTarget) closeDialog(); }}>
      <form class="modal-box" role="dialog" aria-modal="true" aria-labelledby="login-title" id="login" onSubmit={submit}>
        <h2 id="login-title"><Padlock open={false} /> {texts.session.title}</h2>
        <p class="muted">{texts.session.intro}</p>
        <input ref={input} type="password" name="password" required autocomplete="current-password"
               aria-label={texts.session.password} placeholder={texts.session.password} aria-invalid={error()} />
        <Show when={error()}><p class="modal-error" role="alert">{texts.session.error}</p></Show>
        <div class="modal-actions">
          <button type="button" class="btn" onClick={closeDialog}>{texts.session.cancel}</button>
          <button type="submit" class="btn primary" disabled={busy()}>{texts.session.enter}</button>
        </div>
      </form>
    </div>
  );
}

export function LoginDialog() {
  return <Show when={dialog()}><Form /></Show>;
}
