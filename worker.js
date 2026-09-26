// Worker d'Horizon, devant les fichiers de l'application.
//
// Horizon ne s'utilise que depuis le plateau XGS (sauf pour un administrateur) :
// la regle est appliquee par le portail, qui le relaie sous /horizon/. Il ne
// doit donc pas etre joignable a sa propre adresse workers.dev, ni par les
// adresses d'apercu des versions : ces visites sont renvoyees vers le portail.
//
// Le portail, lui, appelle Horizon par sa liaison de service, sous un nom
// interne (horizon.interne) qu'aucun navigateur ne peut atteindre : ces
// requetes recoivent les fichiers normalement.

const PORTAIL = "https://portail-xgs.kgedeon.workers.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname.endsWith(".workers.dev")) {
      return Response.redirect(`${env.PORTAIL_URL || PORTAIL}/horizon${url.pathname}${url.search}`, 302);
    }
    return env.ASSETS.fetch(request);
  },
};
