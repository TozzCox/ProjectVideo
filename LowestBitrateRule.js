/**
 * The copyright in this software is being made available under the BSD License,
 * included below. This software may be subject to other third party and contributor
 * rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2013, Dash Industry Forum.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *  * Redistributions of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 *  * Redistributions in binary form must reproduce the above copyright notice,
 *  this list of conditions and the following disclaimer in the documentation and/or
 *  other materials provided with the distribution.
 *  * Neither the name of Dash Industry Forum nor the names of its
 *  contributors may be used to endorse or promote products derived from this software
 *  without specific prior written permission.
 *
 *  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS AS IS AND ANY
 *  EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 *  IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 *  INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT
 *  NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
 *  PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 *  WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 *  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 *  POSSIBILITY OF SUCH DAMAGE.
 */

var LowestBitrateRule;

var epsilon = 0.1;
var alpha = 0.1;
var gamma = 0.95;
var S_dim = 6;
var A_dim = 11;

var counterRandom = 0;
var saveCounter = 0;

var lastState = 0; // 
var lastAction = 0; // cette variable permet le stockage de la dernière action effectuée 
var Q = new Array(S_dim);


function getTime() {
    var date = new Date();
    var hours = date.getHours();
    var minutes = date.getMinutes();
    var seconds = date.getSeconds();
    if(hours < 10) hours = "0" + hours;
    if(minutes < 10) minutes = "0" + minutes;
    if(seconds <10) seconds = "0" + seconds;

    return hours + ":" + minutes + ":" + seconds;
}

// if(localStorage.getItem("Q") == null || localStorage.getItem("Q") == undefined){
for (var i = 0; i < S_dim; i++) {
    Q[i] = new Array(A_dim);
    for (var j = 0; j < A_dim; j++) {
        Q[i][j] = 0.0;
    }
}

var savedQ = localStorage.getItem("Q");
setInterval(() => {
    console.log("Q at " + getTime());
    console.table(Q);
},  3600000);

/**Récupérer l'état courant S
 * @param bufferLevel tableau contenant les informations metrics
 * @returns l'état dans lequel on se situe - 0, 1, 2, 3, 4 ou 5
 */
function getState(bufferLevel) {
    const level = bufferLevel[bufferLevel.length - 1].level;
    console.log("\nbuffer : "+level);
    if (level < 1000) return 0;
    else if (level < 2000) return 1;
    else if (level < 3000) return 2;
    else if (level < 4000) return 3;
    else if (level < 5000) return 4;
    else return 5;
}

/** Définition d'une récompense selon l'état dans lequel on se trouve
 * @param state état courant
 * @returns la valeur de la récompense comprise entre 0 et 1 
 */
function getReward(state) {
    switch (state) {
        case 0: return 0;
        case 1: return 0.1;
        case 2: return 0.5;
        case 3: return 0.8;
        case 4: return 1;
        case 5: return 0.8;
    }
}

/** Détermine la valeur maximale d'une action selon l'état donné
 * @param state état dans lequel on détermine l'action avec la valeur la plus élevée
 * @returns l'indice de la valeur la plus élevée
 */
function getBestAction(state) {
    let imax = 0;
    for(let i = 0; i < A_dim; i++) {
        if(Q[state][i] > Q[state][imax]) {
            imax = i;
        } 
    }
    return imax;
}

/** Choisie l'action à réaliser selon si on est en exploration ou en exploitation
 * @param state état courant
 * @returns un nombre aléatoire si on explore, la meilleure action si on exploite
 */
function selectAction(state) {
    if(saveCounter < 50 || (saveCounter%(epsilon*100)) == 0 ) {
        //Exploration
        return Math.floor(Math.random() * 11);
    }
    else {
        //Exploitation
        return getBestAction(state);
    }
}

/** Met à jour la matrice Q
 * @param lastAction Dernière action effectuée
 * @param lastState Dernier état défini
 * @param currentState Etat courant
 */
function updateQ(lastAction, lastState, currentState) {
    const lastQ = Q[lastState][lastAction];
    const reward = getReward(currentState);

    Q[lastState][lastAction] =  lastQ + alpha*(reward + gamma*Math.max(...Q[currentState]) - lastQ);
}

// Rule that selects the lowest possible bitrate
function LowestBitrateRuleClass() {

    let factory = dashjs.FactoryMaker;
    let SwitchRequest = factory.getClassFactoryByName('SwitchRequest');
    let MetricsModel = factory.getSingletonFactoryByName('MetricsModel');
    let StreamController = factory.getSingletonFactoryByName('StreamController');
    let context = this.context;
    let instance;

    function setup() {
    }

    // Always use lowest bitrate
    function getMaxIndex(rulesContext) {
        
        // here you can get some informations about metrics for example, to implement the rule
        let metricsModel = MetricsModel(context).getInstance();
        var mediaType = rulesContext.getMediaInfo().type;
        var metrics = metricsModel.getMetricsFor(mediaType, true);

        var nextState = getState(metrics.BufferLevel); // Récupération de l'état courant

        // Ask to switch to the lowest bitrate
        let switchRequest = SwitchRequest(context).create();

        switchRequest.quality = selectAction(nextState); // Attribution de l'action en tant que quality de la vidéo (entre 0 et 10)
        switchRequest.reason = 'Always switching to the lowest bitrate';
        switchRequest.priority = SwitchRequest.PRIORITY.STRONG;

        // Mise à jour de Q à partir de la seconde itération
        if(saveCounter > 0) {
            updateQ(lastAction, lastState, nextState);
        }

        lastState = nextState; // l'état courant devient le dernier état connu
        lastAction = switchRequest.quality; // l'action effectuée devient la dernière action connue
        saveCounter++; // Incrémentation du compteur

        console.table(Q); // affichage de la matrice
        console.log("S" + nextState + " , action " + switchRequest.quality + ", counter " + saveCounter);

        localStorage.setItem("Q", Q); // Stockage de la matrice sur le disque local
        return switchRequest;
    }

    instance = {
        getMaxIndex: getMaxIndex
    };

    setup();

    return instance;
}

LowestBitrateRuleClass.__dashjs_factory_name = 'LowestBitrateRule';
LowestBitrateRule = dashjs.FactoryMaker.getClassFactory(LowestBitrateRuleClass);
