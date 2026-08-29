import { createHash } from 'node:crypto'
import { networkInterfaces, hostname, platform, arch } from 'node:os'

/**
 * Calcule une empreinte stable du poste courant, utilisée pour lier une
 * licence à une machine (modèle "1 clé = 1 poste", voir license.service.ts).
 *
 * Ce n'est PAS une protection anti-piratage absolue — sur un poste desktop
 * hors-ligne, aucune empreinte logicielle n'est infalsifiable par un
 * attaquant déterminé ayant accès au binaire. L'objectif est de dissuader
 * le partage trivial d'une même clé entre plusieurs postes (copier-coller
 * de la clé), pas de résister à une rétro-ingénierie active.
 *
 * Basée sur des identifiants stables entre redémarrages mais spécifiques à
 * la machine (nom d'hôte, plateforme, adresses MAC des interfaces réseau
 * non virtuelles) — jamais sur des données qui changeraient à chaque appel
 * (ex: adresses IP, PID).
 */
export function computeMachineFingerprint(): string {
  const macAddresses = Object.values(networkInterfaces())
    .flat()
    .filter(
      (iface): iface is NonNullable<typeof iface> =>
        !!iface && !iface.internal && iface.mac !== '00:00:00:00:00:00'
    )
    .map((iface) => iface.mac)
    .sort()

  const parts = [hostname(), platform(), arch(), ...macAddresses]

  return createHash('sha256').update(parts.join('|')).digest('hex')
}
