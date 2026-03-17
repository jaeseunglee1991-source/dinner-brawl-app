// src/game/battle.js
const { AFFINITIES, SKILLS, JOBS, GRADES } = require('../data/constants');

const random = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];

function generateDeck(playerName, menus) {
    let deck = [];
    const getId = () => Math.random().toString(36).substr(2, 9);
    
    const applyStartStats = (card) => {
        const has = (sk) => card.skills.some(s => s.name === sk);
        if (has('TANK')) card.maxHp += 100; 
        if (has('WEAK')) card.maxHp -= 50;
        if (has('SWORD_MASTER')) card.atk += 10;
        if (has('SOFT_PUNCH')) card.atk = Math.max(1, Math.floor(card.atk / 2));
        
        card.hp = card.maxHp; 
        if (card.hp <= 0) { card.hp = 1; card.maxHp = 1; }
        if (has('PHOENIX')) card.revived = false; 
        return card;
    };

    // ⭐️ 스탯 풀(Pool) 생성: 1~2개 입력 시 무조건 3인분의 스탯을 독립 시행으로 굴려서 모아둡니다.
    let poolHp = 0, poolAtk = 0, poolMp = 0;
    if (menus.length < 3) {
        for (let i = 0; i < 3; i++) {
            let tempJob = getRandomItem(JOBS);
            let rand = Math.random() * 100;
            let sum = 0; let tempGrade = GRADES[GRADES.length - 1]; 
            for (let g of GRADES) { sum += g.prob; if (rand <= sum) { tempGrade = g; break; } }
            
            let baseHp = random(150, 250);
            let baseAtk = random(15, 25);
            
            poolHp += Math.floor((baseHp * tempGrade.multi) + tempJob.hpBonus);
            poolAtk += Math.floor((baseAtk * tempGrade.multi) + tempJob.atkBonus);
            poolMp += tempJob.maxMp;
        }
    }

    menus.forEach((menu) => {
        // 각 캐릭터 본인의 껍데기(직업, 등급, 상성)는 무조건 1번만 독립 시행으로 뽑습니다.
        let job = getRandomItem(JOBS);
        let rand = Math.random() * 100;
        let sum = 0; let grade = GRADES[GRADES.length - 1]; 
        for (let g of GRADES) { sum += g.prob; if (rand <= sum) { grade = g; break; } }
        let affinity = getRandomItem(AFFINITIES);

        let finalHp, finalAtk, finalMp;
        let assignedSkills = [];

        // ⭐️ 요구사항 1 & 2 분기 처리
        if (menus.length === 1) {
            // 1. 혼자서 3인분 스탯 독식
            finalHp = poolHp;
            finalAtk = poolAtk;
            finalMp = poolMp;
            
            // 특수기술 2개 할당 (중복 방지)
            let sk1 = getRandomItem(SKILLS);
            let sk2 = getRandomItem(SKILLS);
            while(sk1.name === sk2.name) sk2 = getRandomItem(SKILLS);
            assignedSkills = [sk1, sk2];

        } else if (menus.length === 2) {
            // 2. 3인분 스탯을 1/2로 공평하게 분배
            finalHp = Math.floor(poolHp / 2);
            finalAtk = Math.floor(poolAtk / 2);
            finalMp = Math.floor(poolMp / 2);
            
            // 특수기술 1개 할당
            assignedSkills = [getRandomItem(SKILLS)];

        } else {
            // 3. 3개를 꽉 채웠을 때는 각자 본인의 1인분 스탯만 가져감
            let baseHp = random(150, 250);
            let baseAtk = random(15, 25);
            finalHp = Math.floor((baseHp * grade.multi) + job.hpBonus);
            finalAtk = Math.floor((baseAtk * grade.multi) + job.atkBonus);
            finalMp = job.maxMp;
            
            assignedSkills = [getRandomItem(SKILLS)];
        }

        deck.push(applyStartStats({ 
            id: getId(), menu: menu, owner: playerName, 
            grade: grade.name, gradeColor: grade.color, job: job.name,
            maxHp: finalHp, 
            atk: finalAtk,
            maxMp: finalMp, mp: finalMp, 
            affinity: affinity, 
            skills: assignedSkills, 
            maxCooldown: job.atkSpeed, 
            isAlive: true 
        }));
    });
    
    return deck;
}

function calculateAttack(attacker, target, allAliveCards, io) {
    let damage = attacker.atk;
    let attackerDamage = 0, heal = 0, allyHealId = null;
    let msg = `[${attacker.menu}] ⚔️ [${target.menu}]`; let isCrit = false;
    
    if (attacker.mp >= 5) { attacker.mp -= 5; }

    const has = (card, sk) => card.skills.some(s => s.name === sk);
    const isSpec = (aff) => aff === 'MINT_CHOCO' || aff === 'PINEAPPLE';
    
    if (has(attacker, 'COWARD') && Math.random() < 0.2) return { attackerId: attacker.id, targetId: target.id, damage: 0, msg: msg + " (겁먹음!)" };
    if (has(attacker, 'LAZY') && Math.random() < 0.5) return { attackerId: attacker.id, targetId: target.id, damage: 0, msg: msg + " (턴 스킵)" };
    if (has(target, 'NINJA') && Math.random() < 0.3) return { attackerId: attacker.id, targetId: target.id, damage: 0, msg: msg + " (회피!)" };
    if (has(target, 'GUARDIAN') && Math.random() < 0.15) return { attackerId: attacker.id, targetId: target.id, damage: 0, msg: msg + " (완벽방어)" };
    if ((has(attacker, 'CLUMSY') && Math.random() < 0.3) || (has(attacker, 'BLIND') && Math.random() < 0.5)) return { attackerId: attacker.id, targetId: target.id, damage: 0, msg: msg + " (빗나감!)" };
    
    if (isSpec(attacker.affinity) && isSpec(target.affinity) && attacker.affinity !== target.affinity) { damage = 9999; attackerDamage = 9999; msg += ` 💥세계관 붕괴💥`; } 
    else if (isSpec(attacker.affinity) && !isSpec(target.affinity)) { damage *= 2; msg += ` (특수 압도)`; } 
    else { 
        const basicWin = { 'SPICY':'GREASY', 'GREASY':'FRESH', 'FRESH':'SALTY', 'SALTY':'SWEET', 'SWEET':'SPICY' };
        if (basicWin[attacker.affinity] === target.affinity) { damage = Math.floor(damage * 1.5); msg += ` (상성 우위)`; } 
    }

    if (has(attacker, 'BERSERKER') && attacker.hp <= attacker.maxHp / 2) damage *= 2;
    if (has(attacker, 'BULLY') && target.hp < attacker.hp) damage = Math.floor(damage * 1.5);
    if (has(attacker, 'GIANT_KILLER') && target.hp > attacker.hp) damage = Math.floor(damage * 1.5);
    if (has(attacker, 'MAGICIAN') && Math.random() < 0.2) { damage = 40; msg += ` (마법 피해)`; } 
    if (has(attacker, 'LUCKY') && Math.random() < 0.77) damage += 20; 
    if (has(attacker, 'SNIPER') && Math.random() < 0.2) { damage *= 3; isCrit = true; } 
    else if (has(attacker, 'CRITICAL') && Math.random() < 0.5) { damage *= 2; isCrit = true; }

    let terrainRoll = Math.random();
    if (terrainRoll < 0.15) {
        damage = Math.floor(damage * 1.3); 
        msg += ` <span style="color:#2ecc71">[⛰️고지대 강타!]</span>`;
    } else if (terrainRoll < 0.30) {
        damage = Math.floor(damage * 0.7); 
        msg += ` <span style="color:#95a5a6">[🪨단차 엄폐!]</span>`;
    }
    
    if (has(attacker, 'IRON_FIST') && damage < 15) damage = 15;
    if (has(target, 'SHIELD')) damage = Math.floor(damage / 2);
    if (has(target, 'CURSED')) damage = Math.floor(damage * 1.5);
    if (has(target, 'PAPER_SHIELD')) damage += 10;
    
    if (has(attacker, 'LIFESTEAL')) heal = Math.floor(damage / 2);
    if (has(attacker, 'VAMPIRE')) heal = damage;
    if (has(attacker, 'KAMIKAZE') && Math.random() < 0.1) { damage += 100; attackerDamage = 9999; msg += ` 자폭!`; } 
    if (has(attacker, 'ALLERGY')) attackerDamage += 5;
    if (has(attacker, 'FRENZY')) attacker.atk += 2;
    if (has(attacker, 'COMBO')) attacker.atk += 1;
    
    if (has(attacker, 'HEALER')) { 
        let allies = allAliveCards.filter(c => c.owner === attacker.owner && c.id !== attacker.id);
        if(allies.length > 0) allyHealId = getRandomItem(allies).id; 
    }
    if (has(attacker, 'DOUBLE_ATTACK') && Math.random() < 0.3) damage *= 2;
    
    return { attackerId: attacker.id, targetId: target.id, damage, attackerDamage, heal, allyHealId, isCrit, msg };
}

module.exports = { generateDeck, calculateAttack, getRandomItem };
