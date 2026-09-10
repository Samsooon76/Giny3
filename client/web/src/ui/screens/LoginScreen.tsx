import { useState, type FormEvent } from 'react'
import { OfficialScreen } from '../official/OfficialScreen'
import type { BindingResolver } from '../official/types'
import { LoginBackground } from './LoginBackground'

export function LoginScreen({ busy, message, onSubmit }: { busy: boolean; message: string; onSubmit: (login: string, password: string) => void }) {
  const [login, setLogin] = useState('admin'), [password, setPassword] = useState('test')
  const form = <form className="login-form" onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit(login, password) }}>
    <label>Identifiant<input autoFocus autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} /></label>
    <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <button className="giny-submit" disabled={busy || !login || !password}>{busy ? 'CONNEXION…' : 'SE CONNECTER'}</button>
  </form>
  const resolve: BindingResolver = (binding) => {
    // Dofus 3 authenticates through the Ankama launcher, so the official login
    // screen has no credential fields at all — its ctr_login only ever holds
    // the play button. Giny needs a real form, so this one container is widened
    // to the panel it sits in rather than kept at its 170px official size.
    // replaceChildren must stay on ctr_login: hiding btn_play / port without
    // that flag collapses the unsized host and the form never mounts.
    if (binding === 'ctr_login') return { children: form, replaceChildren: true, style: { width: 340, maxWidth: '100%', alignSelf: 'center' } }
    if (binding === 'btn_play' || binding === 'dd_host' || binding === 'ctr_portSelection') return { hidden: true }
    if (binding === 'lbl_message') return { text: message, style: { color: '#ffb1a9' } }
    return undefined
  }
  return (
    <>
      <LoginBackground />
      <OfficialScreen tree="login" resolve={resolve} />
    </>
  )
}

