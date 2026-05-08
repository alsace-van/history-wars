// v1.0 (08/05/2026) — Page auth split-screen, 4 modes via query param
import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams, type NavigateFunction } from 'react-router-dom'
import { Label } from '@ui/components/Label'
import { Input } from '@ui/components/Input'
import { Button } from '@ui/components/Button'
import { PasswordInput } from '@ui/components/PasswordInput'
import { Typewriter } from '@ui/components/Typewriter'
import { AuthBackground } from '@ui/auth/AuthBackground'
import { useAuth } from '@hooks/useAuth'

type Mode = 'signin' | 'signup' | 'reset' | 'update-password'

const VALID_MODES: Mode[] = ['signin', 'signup', 'reset', 'update-password']

const COPY: Record<Mode, { title: string; subtitle: string; quote: string; author: string }> = {
  signin: {
    title: 'Connexion',
    subtitle: 'Reprenez le commandement',
    quote: 'Le genie de la guerre est de bien voir tout d\'un coup d\'oeil.',
    author: 'Napoleon Bonaparte'
  },
  signup: {
    title: 'Creer un compte',
    subtitle: 'Rejoignez la Grande Armee',
    quote: 'Connaitre l\'adversaire et se connaitre soi-meme : en cent batailles, jamais en peril.',
    author: 'Sun Tzu'
  },
  reset: {
    title: 'Mot de passe oublie',
    subtitle: 'On vous renvoie en formation',
    quote: 'En guerre, le moral fait les trois quarts ; les forces reelles, l\'autre quart.',
    author: 'Napoleon Bonaparte'
  },
  'update-password': {
    title: 'Nouveau mot de passe',
    subtitle: 'Reformez les rangs',
    quote: 'La guerre est la continuation de la politique par d\'autres moyens.',
    author: 'Clausewitz'
  }
}

function getMode(raw: string | null): Mode {
  if (raw && VALID_MODES.includes(raw as Mode)) return raw as Mode
  return 'signin'
}

export function Auth() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const mode = getMode(searchParams.get('mode'))
  const { user, loading, signIn, signUp, resetPassword, updatePassword } = useAuth()

  useEffect(() => {
    if (!loading && user && mode !== 'update-password') {
      navigate('/', { replace: true })
    }
  }, [user, loading, mode, navigate])

  const setMode = (next: Mode) => {
    setSearchParams({ mode: next })
  }

  const copy = COPY[mode]

  return (
    <div className="min-h-screen w-full grid md:grid-cols-2 bg-background animate-fade-in">

      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-sm flex flex-col gap-6">
          <div className="text-center">
            <div className="text-2xl font-medium tracking-[0.18em] text-foreground mb-1">TACTICA</div>
            <p className="text-xs text-muted-foreground">Wargame hex tactique</p>
          </div>

          <div className="text-center">
            <h1 className="text-xl font-medium text-foreground mb-1">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>

          {mode === 'signin' && <SignInForm onSignIn={signIn} setMode={setMode} />}
          {mode === 'signup' && <SignUpForm onSignUp={signUp} setMode={setMode} />}
          {mode === 'reset' && <ResetForm onReset={resetPassword} setMode={setMode} />}
          {mode === 'update-password' && (
            <UpdatePasswordForm onUpdate={updatePassword} navigate={navigate} />
          )}
        </div>
      </div>

      <div className="hidden md:block relative overflow-hidden bg-[#0a1224]">
        <AuthBackground />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-background to-transparent" />
        <div className="relative z-10 flex h-full flex-col items-center justify-end p-6 pb-10">
          <blockquote className="space-y-2 text-center">
            <p className="text-base italic font-light text-text-primary leading-relaxed max-w-md">
              &laquo;{' '}
              <Typewriter key={copy.quote} text={copy.quote} speed={45} />{' '}
              &raquo;
            </p>
            <cite className="block text-xs text-muted-foreground not-italic">
              &mdash; {copy.author}
            </cite>
          </blockquote>
        </div>
      </div>

    </div>
  )
}

function SignInForm({
  onSignIn,
  setMode
}: {
  onSignIn: (email: string, password: string) => Promise<{ error: { message: string } | null }>
  setMode: (m: Mode) => void
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await onSignIn(email, password)
    setSubmitting(false)
    if (error) setError(error.message)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-slide-up">
      <div className="grid gap-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input
          id="signin-email"
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="grid gap-2">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="signin-password">Mot de passe</Label>
          <button
            type="button"
            onClick={() => setMode('reset')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Mot de passe oublie ?
          </button>
        </div>
        <PasswordInput
          id="signin-password"
          autoComplete="current-password"
          placeholder="Mot de passe"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && <FormError message={error} />}
      <Button type="submit" variant="default" disabled={submitting} className="mt-2">
        {submitting ? 'Connexion...' : 'Se connecter'}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        Pas de compte ?{' '}
        <button
          type="button"
          onClick={() => setMode('signup')}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Creer un compte
        </button>
      </div>
    </form>
  )
}

function SignUpForm({
  onSignUp,
  setMode
}: {
  onSignUp: (
    email: string,
    password: string,
    username: string
  ) => Promise<{ error: { message: string } | null }>
  setMode: (m: Mode) => void
}) {
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caracteres')
      return
    }
    setSubmitting(true)
    const { error } = await onSignUp(email, password, username)
    setSubmitting(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Compte cree. Verifiez votre email pour confirmer votre inscription.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-slide-up">
      <div className="grid gap-2">
        <Label htmlFor="signup-username">Pseudo</Label>
        <Input
          id="signup-username"
          type="text"
          placeholder="Napoleon"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={24}
          required
        />
        <p className="text-xs text-muted-foreground">Visible par les autres joueurs.</p>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input
          id="signup-email"
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <PasswordInput
        id="signup-password"
        label="Mot de passe"
        autoComplete="new-password"
        placeholder="8 caracteres minimum"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      {error && <FormError message={error} />}
      {success && <FormSuccess message={success} />}
      <Button type="submit" variant="default" disabled={submitting} className="mt-2">
        {submitting ? 'Creation...' : 'Creer mon compte'}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        Deja inscrit ?{' '}
        <button
          type="button"
          onClick={() => setMode('signin')}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Se connecter
        </button>
      </div>
    </form>
  )
}

function ResetForm({
  onReset,
  setMode
}: {
  onReset: (email: string) => Promise<{ error: { message: string } | null }>
  setMode: (m: Mode) => void
}) {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSubmitting(true)
    const { error } = await onReset(email)
    setSubmitting(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Email envoye. Verifiez votre boite de reception pour le lien de reinitialisation.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-slide-up">
      <div className="grid gap-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          placeholder="vous@exemple.fr"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <FormError message={error} />}
      {success && <FormSuccess message={success} />}
      <Button type="submit" variant="default" disabled={submitting} className="mt-2">
        {submitting ? 'Envoi...' : 'Envoyer le lien'}
      </Button>
      <div className="text-center text-sm text-muted-foreground">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className="text-foreground underline-offset-4 hover:underline"
        >
          Retour a la connexion
        </button>
      </div>
    </form>
  )
}

function UpdatePasswordForm({
  onUpdate,
  navigate
}: {
  onUpdate: (newPassword: string) => Promise<{ error: { message: string } | null }>
  navigate: NavigateFunction
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caracteres')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas')
      return
    }
    setSubmitting(true)
    const { error } = await onUpdate(password)
    setSubmitting(false)
    if (error) {
      setError(error.message)
    } else {
      setSuccess('Mot de passe mis a jour. Redirection...')
      setTimeout(() => navigate('/', { replace: true }), 1500)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 animate-slide-up">
      <PasswordInput
        id="update-password"
        label="Nouveau mot de passe"
        autoComplete="new-password"
        placeholder="8 caracteres minimum"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
      />
      <PasswordInput
        id="update-password-confirm"
        label="Confirmer"
        autoComplete="new-password"
        placeholder="Repetez le mot de passe"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        minLength={8}
        required
      />
      {error && <FormError message={error} />}
      {success && <FormSuccess message={success} />}
      <Button type="submit" variant="default" disabled={submitting} className="mt-2">
        {submitting ? 'Mise a jour...' : 'Valider'}
      </Button>
    </form>
  )
}

function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
    >
      {message}
    </div>
  )
}

function FormSuccess({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="rounded-md border border-tactica-green/40 bg-tactica-green/10 px-3 py-2 text-xs text-tactica-green"
    >
      {message}
    </div>
  )
}
