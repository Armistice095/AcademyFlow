import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { shell } from 'electron'
import { google } from 'googleapis'
import type { OAuth2Client } from 'google-auth-library'

/**
 * Connexion du compte Google Drive (ARCHITECTURE.md §7, Phase 9.3).
 *
 * Une application de bureau ne peut pas garder un secret client
 * confidentiel ni recevoir de redirection HTTPS publique : le flux
 * recommandé par Google pour ce cas ("installed app") ouvre le navigateur
 * système sur l'écran de consentement, puis récupère le code d'autorisation
 * via un petit serveur HTTP local temporaire écoutant sur `127.0.0.1`
 * (adresse de boucle locale — jamais exposée au réseau). PKCE est utilisé en
 * complément pour empêcher l'interception du code par un autre processus
 * local pendant la fenêtre de redirection.
 *
 * Portée volontairement minimale : `drive.file` ne donne accès qu'aux
 * fichiers créés par l'application elle-même, jamais au reste du Drive de
 * l'utilisateur.
 */

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/userinfo.email']
const LOOPBACK_TIMEOUT_MS = 5 * 60 * 1000

export interface GoogleOAuthCredentials {
  clientId: string
  clientSecret: string
}

/** Lit les identifiants d'application OAuth (config développeur — voir `.env.example`). */
export function getOAuthCredentials(): GoogleOAuthCredentials {
  const clientId = process.env.GOOGLE_DRIVE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_DRIVE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error(
      "Configuration Google Drive manquante sur ce poste. Un administrateur doit renseigner " +
        'GOOGLE_DRIVE_CLIENT_ID et GOOGLE_DRIVE_CLIENT_SECRET (voir .env.example à la racine du projet).'
    )
  }

  return { clientId, clientSecret }
}

export interface GoogleAuthorizationResult {
  refreshToken: string
  accountEmail: string
}

function buildResponsePage(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:sans-serif;text-align:center;padding:64px 24px;color:#1e293b}</style>
</head><body><h2>${title}</h2><p>${message}</p></body></html>`
}

/**
 * Exécute le flux complet : ouverture du navigateur → consentement →
 * réception du code sur le serveur local → échange contre les jetons →
 * résolution de l'adresse e-mail du compte connecté.
 */
export async function runLoopbackAuthorization(): Promise<GoogleAuthorizationResult> {
  const { clientId, clientSecret } = getOAuthCredentials()

  const pkceHelper = new google.auth.OAuth2()
  const { codeVerifier, codeChallenge } = await pkceHelper.generateCodeVerifierAsync()

  return new Promise<GoogleAuthorizationResult>((resolve, reject) => {
    let settled = false
    let redirectUri = ''

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error("Délai d'autorisation dépassé (5 minutes) — veuillez réessayer."))
    }, LOOPBACK_TIMEOUT_MS)

    function cleanup(): void {
      clearTimeout(timeout)
      server.close()
    }

    function settle(fn: () => void): void {
      if (settled) return
      settled = true
      fn()
    }

    async function exchangeCode(code: string): Promise<void> {
      try {
        const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
        const { tokens } = await client.getToken({ code, codeVerifier })

        if (!tokens.refresh_token) {
          throw new Error(
            "Google n'a pas renvoyé de jeton de rafraîchissement. " +
              "Révoquez l'accès existant sur myaccount.google.com/permissions puis réessayez."
          )
        }

        client.setCredentials(tokens)
        const email = await resolveAccountEmail(client)

        settle(() => resolve({ refreshToken: tokens.refresh_token as string, accountEmail: email }))
      } catch (error) {
        settle(() => reject(error instanceof Error ? error : new Error("Échec de l'échange du code d'autorisation.")))
      }
    }

    const server = createServer((req, res) => {
      if (!req.url || !req.url.startsWith('/oauth2callback')) {
        res.writeHead(404).end()
        return
      }

      const url = new URL(req.url, 'http://127.0.0.1')
      const code = url.searchParams.get('code')
      const errorParam = url.searchParams.get('error')

      if (errorParam) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(buildResponsePage('Connexion annulée', 'Vous pouvez fermer cette fenêtre et revenir à AcademyFlow.'))
        cleanup()
        settle(() => reject(new Error("Autorisation refusée par l'utilisateur.")))
        return
      }

      if (!code) {
        res.writeHead(400).end()
        return
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(buildResponsePage('Connexion réussie', 'Vous pouvez fermer cette fenêtre et revenir à AcademyFlow.'))
      cleanup()

      void exchangeCode(code)
    })

    server.on('error', (error) => {
      cleanup()
      settle(() => reject(error))
    })

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      redirectUri = `http://127.0.0.1:${port}/oauth2callback`

      const authClient = new google.auth.OAuth2(clientId, clientSecret, redirectUri)
      const authUrl = authClient.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: SCOPES,
        code_challenge_method: 'S256' as never,
        code_challenge: codeChallenge
      })

      shell.openExternal(authUrl).catch((error) => {
        cleanup()
        settle(() => reject(error instanceof Error ? error : new Error("Impossible d'ouvrir le navigateur système.")))
      })
    })
  })
}

async function resolveAccountEmail(client: OAuth2Client): Promise<string> {
  const oauth2 = google.oauth2({ auth: client, version: 'v2' })
  const { data } = await oauth2.userinfo.get()
  if (!data.email) {
    throw new Error("Impossible de résoudre l'adresse e-mail du compte Google connecté.")
  }
  return data.email
}
