# Onglet Réglages

[English (EN)](../tab-settings.md)

**Thème** de l’UI par feuille, **import/export**, **outils MJ**, **permissions** et **bascules de comportement**.

## Qui peut modifier

Couleurs, bascules et import de feuille nécessitent la permission **édition** sur la feuille active. Les **permissions de feuille** et **import/export tout** sont réservés au **MJ**.

## Couleurs de l’interface

Trois sélecteurs de couleur (**fond**, **bordure / UI**, **texte**) définissent l’apparence de la feuille dans l’extension. **Réinitialiser** remet les valeurs par défaut si vous pouvez éditer.

## Bascules (même ligne)

- **Jet rapide auto** — activé : clic normal sur un talent = jet rapide ; **Maj+clic** ouvre la préparation de jet (inversé si désactivé). L’infobulle du bouton vitesse sur Stats reflète le mode.
- **Est un élémentaire** — active les règles élémentaires (max PV 1, max PM spécifique, dégâts physiques absorbés dans la logique d’application, magiques/bruts après défense sur les PV temp. puis le surplus sur la mana, sorts coûtant des PV payés en PM, etc.). À l’activation : PV actuels bornés au max, PM au max ; les PV temp. ne sont **pas** remis à zéro.

## Import / export (feuille)

- **Exporter la feuille** — JSON de sauvegarde ou de migration manuelle.
- **Importer la feuille** — remplace la feuille active depuis un fichier JSON (destructif ; confirmation dans l’app).

## Blocs réservés au MJ

- **Permissions de feuille** — pour chaque membre (sauf la ligne MJ), bascules **peut voir** / **peut éditer** pour la feuille **courante**.
- **Importer tout / Exporter tout** — sauvegarde ou restauration globale de la room (à manier avec précaution).

## Voir aussi

- [Base de données](database.md) — colonnes `is_elemental`, `auto_quick_roll`, thème, permissions.
