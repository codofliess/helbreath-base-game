void CGame::UseItemHandler(int iClientH, short sItemIndex, short dX, short dY, short sDestItemID)
{
 int iTemp, iMax, iV1, iV2, iV3, iSEV1, iEffectResult = 0;
 DWORD dwTime;
 short sTemp, sTmpType, sTmpAppr1;
 char cSlateType[20];

	dwTime = timeGetTime();
	ZeroMemory(cSlateType,sizeof(cSlateType));

	//testcode
	//wsprintf(G_cTxt, "%d", sDestItemID);
	//PutLogList(G_cTxt);

	if (m_pClientList[iClientH] == 0) return;
	if (m_pClientList[iClientH]->m_bIsKilled ) return;
	if (m_pClientList[iClientH]->m_bIsInitComplete == false) return;

	if ((sItemIndex < 0) || (sItemIndex >= DEF_MAXITEMS)) return;
	if (m_pClientList[iClientH]->m_pItemList[sItemIndex] == 0) return;

	if ( (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_USE_DEPLETE) ||
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_USE_PERM) ||
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_ARROW) || 
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_EAT) ||
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_USE_SKILL) ||
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_USE_DEPLETE_DEST) ) {
	}
	else return;
 	
	if ( (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_USE_DEPLETE) ||
		 (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_cItemType == DEF_ITEMTYPE_EAT) ) {
				
		// Â¾Ã†Ã€ÃŒÃ…Ã›Ã€Ã‡ ÃˆÂ¿Â°ÃºÂ¿Â¡ Â¸Ã‚Â´Ã‚ ÃƒÂ³Â¸Â®Â¸Â¦ Ã‡Ã‘Â´Ã™. 
		switch (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectType) {
		case DEF_ITEMEFFECTTYPE_WARM: // v2.172 2002-7-5 ï¿½Øµï¿½ ï¿½Ã¾ï¿½. 

			// ï¿½Ãµï¿½ ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ ï¿½ï¿½ï¿½ ï¿½Øµï¿½ ï¿½Ç¾ï¿½ï¿½Ù´ï¿½ ï¿½Þ¼ï¿½ï¿½ï¿½ï¿½ï¿½ ï¿½ï¿½ï¿½ï¿½ï¿½Ø´ï¿½. 
			if (m_pClientList[iClientH]->m_cMagicEffectStatus[ DEF_MAGICTYPE_ICE ] == 1) {
			//	SetIceFlag(iClientH, DEF_OWNERTYPE_PLAYER, false);

				bRemoveFromDelayEventList(iClientH, DEF_OWNERTYPE_PLAYER, DEF_MAGICTYPE_ICE);

				// È¿ï¿½ï¿½ï¿½ï¿½ ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ ï¿½ï¿½ ï¿½ß»ï¿½ï¿½ï¿½ ï¿½ï¿½ï¿½ï¿½ï¿½ï¿½ ï¿½Ìºï¿½Æ®ï¿½ï¿½ ï¿½ï¿½ï¿½ï¿½Ñ´ï¿½.
				bRegisterDelayEvent(DEF_DELAYEVENTTYPE_MAGICRELEASE, DEF_MAGICTYPE_ICE, dwTime + (1*1000), 
							                iClientH, DEF_OWNERTYPE_PLAYER, 0, 0, 0, 1, 0, 0);

								
//				SendNotifyMsg(0, iClientH, DEF_NOTIFY_MAGICEFFECTOFF, DEF_MAGICTYPE_ICE, 0, 0, 0);
			}

			m_pClientList[iClientH]->m_dwWarmEffectTime = dwTime;
			break;

		case DEF_ITEMEFFECTTYPE_LOTTERY:
			// ÂºÂ¹Â±Ã‡ Â¾Ã†Ã€ÃŒÃ…Ã› EV1(ÃˆÂ®Â·Ã¼: ÃƒÃ–Ã€Ãº 100) EV2(Â»Ã³Ã‡Â° ÃÂ¾Â·Ã¹) EV3(Â»Ã³Ã‡Â° Â¼Ã¶Â·Â®)
			iTemp = iDice(1, m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1);
			if (iTemp == iDice(1, m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1)) {
				// Â´Ã§ÃƒÂ·!

			}
			else {
				// Â²ÃŽ!
				
			}
			break;
		
		case DEF_ITEMEFFECTTYPE_SLATES:
			if (m_pClientList[iClientH]->m_pItemList[sItemIndex] != 0) {
				// Full Ancient Slate ??
				if (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sIDnum == 867) {
					// Slates dont work on Heldenian Map
					switch (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2){
						case 2: // Bezerk slate
							m_pClientList[iClientH]->m_cMagicEffectStatus[ DEF_MAGICTYPE_BERSERK ] = true;
							SetBerserkFlag(iClientH, DEF_OWNERTYPE_PLAYER, true);
							bRegisterDelayEvent(DEF_DELAYEVENTTYPE_MAGICRELEASE, DEF_MAGICTYPE_BERSERK, dwTime + (1000 * 600),
								iClientH, DEF_OWNERTYPE_PLAYER, 0, 0, 0, 1, 0, 0);
							SendNotifyMsg(0, iClientH, DEF_NOTIFY_MAGICEFFECTON, DEF_MAGICTYPE_BERSERK, 1, 0, 0);
							strcpy(cSlateType, "Berserk");
							break;

						case 1: // Invincible slate
							if (strlen(cSlateType) == 0) {
								strcpy(cSlateType, "Invincible");
							}
						case 3: // Mana slate
							if (strlen(cSlateType) == 0) {
								strcpy(cSlateType, "Mana");
							}
						case 4: // Exp slate
							if (strlen(cSlateType) == 0) {
								strcpy(cSlateType, "Exp");
							}
							SetSlateFlag(iClientH, m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2, true);
							bRegisterDelayEvent(DEF_DELAYEVENTTYPE_ANCIENT_TABLET, m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2, 
												dwTime + (1000 * 600), iClientH, DEF_OWNERTYPE_PLAYER, 0, 0, 0, 1, 0, 0);
							switch(m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2) {
							case 1:
								iEffectResult = 4;
								break;
							case 3:
								iEffectResult = 5;
								break;
							case 4:
								iEffectResult = 6;
								break;
							}
					}
					if(strlen(cSlateType) > 0)
						_bItemLog(DEF_ITEMLOG_USE, iClientH, strlen(cSlateType), m_pClientList[iClientH]->m_pItemList[sItemIndex]);
				}
			}
			break;
		case DEF_ITEMEFFECTTYPE_HP:
			iMax = iGetMaxHP(iClientH);
			if (m_pClientList[iClientH]->m_iHP < iMax) {
				
				if (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1 == 0) {
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue3;
				}
				else {
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue3;
				}

				m_pClientList[iClientH]->m_iHP += (iDice(iV1, iV2) + iV3); 
				if (m_pClientList[iClientH]->m_iHP > iMax) m_pClientList[iClientH]->m_iHP = iMax;
				if (m_pClientList[iClientH]->m_iHP <= 0)   m_pClientList[iClientH]->m_iHP = 1;

				iEffectResult = 1;
			}
			break;

		case DEF_ITEMEFFECTTYPE_MP:
			iMax = iGetMaxMP(iClientH);
		
			if (m_pClientList[iClientH]->m_iMP < iMax) {
				
				if (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1 == 0) {
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue3;
				}
				else 
				{
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue3;
				}

				m_pClientList[iClientH]->m_iMP += (iDice(iV1, iV2) + iV3); 
				if (m_pClientList[iClientH]->m_iMP > iMax) 
					m_pClientList[iClientH]->m_iMP = iMax;

				iEffectResult = 2;
			}
			break;
		case DEF_ITEMEFFECTTYPE_CRITKOMM:
			//CritInc(iClientH);
			break;
		case DEF_ITEMEFFECTTYPE_SP:
			iMax = iGetMaxSP(iClientH);
		
			if (m_pClientList[iClientH]->m_iSP < iMax) {
				
				if (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1 == 0) {
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue3;
				}
				else {
					iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1;
					iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue2;
					iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue3;
				}

				m_pClientList[iClientH]->m_iSP += (iDice(iV1, iV2) + iV3); 
				if (m_pClientList[iClientH]->m_iSP > iMax) 
					m_pClientList[iClientH]->m_iSP = iMax;

				iEffectResult = 3;
			}

			if (m_pClientList[iClientH]->m_bIsPoisoned ) {
				// ÃÃŸÂµÂ¶ÂµÃˆ Â»Ã³Ã…Ã‚Â¿Â´Â´Ã™Â¸Ã© ÃÃŸÂµÂ¶Ã€Â» Ã‡Â¬Â´Ã™.
				m_pClientList[iClientH]->m_bIsPoisoned = false;
				// ÃÃŸÂµÂ¶Ã€ÃŒ Ã‡Â®Â·ÃˆÃ€Â½Ã€Â» Â¾Ã‹Â¸Â°Â´Ã™. 
				SetPoisonFlag(iClientH, DEF_OWNERTYPE_PLAYER, false); // removes poison aura when using a revitalizing potion
				SendNotifyMsg(0, iClientH, DEF_NOTIFY_MAGICEFFECTOFF, DEF_MAGICTYPE_POISON, 0, 0, 0);
			}
			break;

		case DEF_ITEMEFFECTTYPE_HPSTOCK:
			iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
			iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue2;
			iV3 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue3;
		
			m_pClientList[iClientH]->m_iHPstock += iDice(iV1, iV2) + iV3;
			if (m_pClientList[iClientH]->m_iHPstock < 0)   m_pClientList[iClientH]->m_iHPstock = 0;
			if (m_pClientList[iClientH]->m_iHPstock > 500) m_pClientList[iClientH]->m_iHPstock = 500;

			// Â¹Ã¨Â°Ã­Ã‡Ã„Ã€Â» Ã‡Ã˜Â°Ã¡Ã‡Ã‘Â´Ã™. 
			m_pClientList[iClientH]->m_iHungerStatus += iDice(iV1, iV2) + iV3;
			if (m_pClientList[iClientH]->m_iHungerStatus > 100) m_pClientList[iClientH]->m_iHungerStatus = 100;
			if (m_pClientList[iClientH]->m_iHungerStatus < 0)   m_pClientList[iClientH]->m_iHungerStatus = 0;
			break;

		case DEF_ITEMEFFECTTYPE_STUDYSKILL:
			// Â±Ã¢Â¼ÃºÃ€Â» Â¹Ã¨Â¿Ã®Â´Ã™.	
			iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
			iV2 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue2;
			iSEV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemSpecEffectValue1;
			// iV1Ã€Âº Â¹Ã¨Â¿Ã¯ Skill Â¹Ã¸ÃˆÂ£. iV2Â´Ã‚ Â±Ã¢Â¼Ãº Â¼Ã¶ÃÃ˜, iSEV1Ã€Âº Â»Ã§Â¿Ã«Ã€Ãš ÃÂ¤Ã€Ã‡ Â±Ã¢Â¼Ãº Â¼Ã¶ÃÃ˜(Â¿Ã¬Â¼Â±Â¼Ã¸Ã€Â§) 
			if (iSEV1 == 0) {
				// Â»Ã§Â¿Ã«Ã€Ãš ÃÂ¤Ã€Ã‡ Â±Ã¢Â¼ÃºÂ¼Ã¶ÃÃ˜Ã€ÃŒ 0Ã€ÃŒÂ¶Ã³Â¸Ã© Ã‡Â¥ÃÃ˜ Â±Ã¢Â¼ÃºÂ¼Ã¶ÃÃ˜Â¿Â¡ ÂµÃ»Â¶Ã³ Â±Ã¢Â¼ÃºÃ€Â» Â¹Ã¨Â¿Ã¬Â°Ã” ÂµÃˆÂ´Ã™. 
				TrainSkillResponse(true, iClientH, iV1, iV2);
			}
			else {
		   		TrainSkillResponse(true, iClientH, iV1, iSEV1);
			}
			break;

		case DEF_ITEMEFFECTTYPE_STUDYMAGIC:
			// iV1Ã€Âº Â¹Ã¨Â¿Ã¯ Â¸Â¶Â¹Ã½ Â¹Ã¸ÃˆÂ£.
			iV1 = m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1;
			if (m_pMagicConfigList[iV1] != 0) 
				RequestStudyMagicHandler(iClientH, m_pMagicConfigList[iV1]->m_cName, false);
			break;

		/*case DEF_ITEMEFFECTTYPE_LOTTERY:
			iLottery = iDice(1, m_pClientList[iClientH]->m_pItemList[sItemIndex]->
			break;*/

		// New 15/05/2004 Changed
		case DEF_ITEMEFFECTTYPE_MAGIC:
			// Ã…ÃµÂ¸Ã­ Â¸Ã°ÂµÃ¥Â¿Â´Â´Ã™Â¸Ã© Â¸Â¶Â¹Ã½ ÃˆÂ¿Â°Ãº Â¾Ã†Ã€ÃŒÃ…Ã› Â»Ã§Â¿Ã«Â½ÃƒÂ¿Â¡ Ã‡Ã˜ÃÂ¦ÂµÃˆÂ´Ã™.
			if ( (m_pClientList[iClientH]->m_iStatus & 0x10) != 0 ) {
				if (m_pClientList[iClientH]->m_iAdminUserLevel == 0) {
					SetInvisibilityFlag(iClientH, DEF_OWNERTYPE_PLAYER, false);
				
					bRemoveFromDelayEventList(iClientH, DEF_OWNERTYPE_PLAYER, DEF_MAGICTYPE_INVISIBILITY);
					m_pClientList[ iClientH ]->m_cMagicEffectStatus[ DEF_MAGICTYPE_INVISIBILITY ] = 0;
				}
			}

			switch (m_pClientList[iClientH]->m_pItemList[sItemIndex]->m_sItemEffectValue1) {
