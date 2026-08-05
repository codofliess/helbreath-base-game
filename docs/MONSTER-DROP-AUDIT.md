# Monster Drop Audit — Olympia objective vs Chain Lords

Generated: 2026-07-30T02:54:06.477Z

## Method

| Field | Meaning |
|-------|---------|
| **chance** | Independent roll probability on our server (rating-0 bake) |
| **tier** | Product class: common / consumable / stone / rare / legendary / gold |
| **CL invented** | Present only on CL (kept; not an Olympia gap) |

Runtime caps (normal mobs): gold independent; **at most one** consumable-bucket + **one** gear + **one** rare per kill.

## Per-monster tables

### Ettin (id 0 · sprite `ettin` · gen 10)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-170 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 382 | Bloody Shock W.Manual | 0.430% · qty 1 | rare |  |
| 50 | Great Sword | 0.420% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.420% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.420% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.420% · qty 1 | common |  |
| 615 | Giant Sword | 0.420% · qty 1 | common |  |
| 761 | Battle Hammer | 0.420% · qty 1 | common |  |
| 457 | Scale Mail(M) | 0.269% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.269% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.235% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.235% · qty 1 | common |  |
| 600 | Helm(M) | 0.202% · qty 1 | common |  |
| 602 | Helm(W) | 0.202% · qty 1 | common |  |
| 853 | E.S.W.Manual | 0.130% · qty 1 | rare |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0672% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0672% · qty 1 | common |  |
| 402 | Cape | 0.0672% · qty 1 | common |  |
| 451 | Long Boots | 0.0672% · qty 1 | common |  |
| 762 | Giant Battle Hammer | 0.0550% · qty 1 | rare |  |
| 843 | Barbarian Hammer | 0.0500% · qty 1 | rare |  |
| 735 | Ringof Dragonpower | 0.0420% · qty 1 | rare |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Slime (id 1 · sprite `slm` · gen 1)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-30 | gold |  |
| 220 | Slime Jelly | 4.00% · qty 1 | common |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 1 | Dagger | 0.840% · qty 1 | common |  |
| 8 | Short Sword | 0.840% · qty 1 | common |  |
| 59 | Light Axe | 0.840% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Ant (id 2 · sprite `ant` · gen 1)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 192 | Ant Leg | 3.70% · qty 1 | common |  |
| 193 | Ant Feeler | 3.30% · qty 1 | common |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 1 | Dagger | 0.840% · qty 1 | common |  |
| 8 | Short Sword | 0.840% · qty 1 | common |  |
| 59 | Light Axe | 0.840% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Snake (id 3 · sprite `amp` · gen 1)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-30 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 188 | Snake Meat | 1.33% · qty 1 | common |  |
| 189 | Snake Skin | 1.25% · qty 1 | common |  |
| 190 | Snake Teeth | 1.25% · qty 1 | common |  |
| 191 | Snake Tongue | 1.18% · qty 1 | common |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 1 | Dagger | 0.840% · qty 1 | common |  |
| 8 | Short Sword | 0.840% · qty 1 | common |  |
| 59 | Light Axe | 0.840% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Dragon (id 5 · sprite `barlog` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-300 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 382 | Bloody Shock W.Manual | 1.20% · qty 1 | rare |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 732 | Dark Mage Magic Staff W | 0.110% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Beholder (id 7 · sprite `beholder` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-120 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 380 | Ice Storm Manual | 1.00% · qty 1 | legendary |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Cannibal Plant (id 9 · sprite `canplant` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-120 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Centaurus (id 11 · sprite `centaurus` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-200 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 735 | Ringof Dragonpower | 0.130% · qty 1 | rare |  |
| 732 | Dark Mage Magic Staff W | 0.110% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Clay Golem (id 12 · sprite `cla` · gen 3)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-40 | gold |  |
| 205 | Lumpof Clay | 3.30% · qty 1 | common |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 68 | Double Axe | 0.504% · qty 1 | common |  |
| 23 | Sabre | 0.504% · qty 1 | common |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 85 | Lagi Shield | 0.112% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.112% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.112% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.112% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.112% · qty 1 | common |  |
| 590 | Robe(M) | 0.112% · qty 1 | common |  |
| 591 | Robe(W) | 0.112% · qty 1 | common |  |
| 453 | Shirt(M) | 0.112% · qty 1 | common |  |
| 471 | Shirt(W) | 0.112% · qty 1 | common |  |
| 470 | Chemise(W) | 0.112% · qty 1 | common |  |
| 473 | Bodice(W) | 0.112% · qty 1 | common |  |
| 484 | Tunic(M) | 0.112% · qty 1 | common |  |
| 459 | Trousers(M) | 0.112% · qty 1 | common |  |
| 480 | Trousers(W) | 0.112% · qty 1 | common |  |
| 479 | Skirt(W) | 0.112% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Claw Turtle (id 13 · sprite `clawturtle` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-130 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Cyclops (id 14 · sprite `cyc` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-80 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 197 | Cyclops Meat | 0.760% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 196 | Cyclops Heart | 0.560% · qty 1 | common |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 194 | Cyclops Eye | 0.460% · qty 1 | common |  |
| 195 | Cyclops Hand Edge | 0.420% · qty 1 | common |  |
| 198 | Cyclops Leather | 0.420% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Dark Elf (id 15 · sprite `darkelf` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-160 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 618 | Dark Elf Bow | 0.130% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Demon (id 18 · sprite `demon` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-300 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 543 | Demon Leather | 0.100% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 491 | Blood Axe | 0.0800% · qty 1 | rare |  |
| 492 | Blood Rapier | 0.0800% · qty 1 | rare |  |
| 490 | Blood Sword | 0.0800% · qty 1 | rare |  |
| 633 | Ringof Demonpower | 0.0700% · qty 1 | rare |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 540 | Demon Eye | 0.0670% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 541 | Demon Heart | 0.0500% · qty 1 | common |  |
| 382 | Bloody Shock W.Manual | 0.0500% · qty 1 | rare |  |
| 645 | Knecklace Of Efreet | 0.0500% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 616 | Demon Slayer | 0.0400% · qty 1 | common |  |
| 860 | Necklace Of Xelima | 0.0400% · qty 1 | legendary |  |
| 861 | Berserk Wand(MS.20) | 0.0400% · qty 1 | legendary |  |
| 862 | Berserk Wand(MS.10) | 0.0400% · qty 1 | legendary |  |
| 865 | Resur Wand(MS.20) | 0.0350% · qty 1 | common |  |
| 866 | Resur Wand(MS.10) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 542 | Demon Meat | 0.0200% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Frost (id 20 · sprite `frost` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-150 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 732 | Dark Mage Magic Staff W | 0.110% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 380 | Ice Storm Manual | 0.0500% · qty 1 | legendary |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 845 | Storm Bringer | 0.0450% · qty 1 | legendary |  |
| 614 | Swordof Ice Elemental | 0.0400% · qty 1 | rare |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Gargoyle (id 21 · sprite `gagoyle` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-350 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 633 | Ringof Demonpower | 0.0700% · qty 1 | rare |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 630 | Ringofthe Xelima | 0.0600% · qty 1 | legendary |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 610 | Xelima Blade | 0.0500% · qty 1 | legendary |  |
| 611 | Xelima Axe | 0.0500% · qty 1 | legendary |  |
| 612 | Xelima Rapier | 0.0500% · qty 1 | legendary |  |
| 735 | Ringof Dragonpower | 0.0500% · qty 1 | rare |  |
| 645 | Knecklace Of Efreet | 0.0500% · qty 1 | common |  |
| 646 | Necklace Of Beholder | 0.0500% · qty 1 | common |  |
| 382 | Bloody Shock W.Manual | 0.0500% · qty 1 | rare |  |
| 872 | Bane | 0.0500% · qty 1 | legendary |  |
| 847 | Dark Executor | 0.0450% · qty 1 | rare |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 631 | Ringofthe Abaddon | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Giant Cray Fish (id 24 · sprite `giantcrayfish` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-160 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Giant Frog (id 25 · sprite `giantfrog` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-60 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Giant Lizard (id 26 · sprite `giantlizard` · gen 10)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-350 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.420% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.420% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.420% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.420% · qty 1 | common |  |
| 615 | Giant Sword | 0.420% · qty 1 | common |  |
| 761 | Battle Hammer | 0.420% · qty 1 | common |  |
| 457 | Scale Mail(M) | 0.269% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.269% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.235% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.235% · qty 1 | common |  |
| 600 | Helm(M) | 0.202% · qty 1 | common |  |
| 602 | Helm(W) | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0672% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0672% · qty 1 | common |  |
| 402 | Cape | 0.0672% · qty 1 | common |  |
| 451 | Long Boots | 0.0672% · qty 1 | common |  |
| 762 | Giant Battle Hammer | 0.0550% · qty 1 | rare |  |
| 843 | Barbarian Hammer | 0.0500% · qty 1 | rare |  |
| 853 | E.S.W.Manual | 0.0450% · qty 1 | rare |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Giant Tree (id 27 · sprite `giantplant` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-120 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Stone Golem (id 28 · sprite `gol` · gen 3)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-40 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 221 | Stone Golem Piece | 1.67% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 68 | Double Axe | 0.504% · qty 1 | common |  |
| 23 | Sabre | 0.504% · qty 1 | common |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 85 | Lagi Shield | 0.112% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.112% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.112% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.112% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.112% · qty 1 | common |  |
| 590 | Robe(M) | 0.112% · qty 1 | common |  |
| 591 | Robe(W) | 0.112% · qty 1 | common |  |
| 453 | Shirt(M) | 0.112% · qty 1 | common |  |
| 471 | Shirt(W) | 0.112% · qty 1 | common |  |
| 470 | Chemise(W) | 0.112% · qty 1 | common |  |
| 473 | Bodice(W) | 0.112% · qty 1 | common |  |
| 484 | Tunic(M) | 0.112% · qty 1 | common |  |
| 459 | Trousers(M) | 0.112% · qty 1 | common |  |
| 480 | Trousers(W) | 0.112% · qty 1 | common |  |
| 479 | Skirt(W) | 0.112% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Hellhound (id 32 · sprite `helb` · gen 4)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-60 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 199 | Helbound Heart | 2.50% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 25 | Scimitar | 0.403% · qty 1 | common |  |
| 28 | Falchion | 0.403% · qty 1 | common |  |
| 31 | Esterk | 0.403% · qty 1 | common |  |
| 34 | Rapier | 0.403% · qty 1 | common |  |
| 71 | War Axe | 0.403% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 86 | Knight Shield | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Hellclaw (id 33 · sprite `hellclaw` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-700 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 308 | Magic Necklace(MS10) | 2.50% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 633 | Ringof Demonpower | 0.0600% · qty 1 | rare |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 735 | Ringof Dragonpower | 0.0500% · qty 1 | rare |  |
| 620 | Merien Shield | 0.0450% · qty 1 | legendary |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 860 | Necklace Of Xelima | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Ice Golem (id 34 · sprite `icegolem` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-60 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Master Mage Orc (id 36 · sprite `mastermageorc` · gen 10)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-180 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.420% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.420% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.420% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.420% · qty 1 | common |  |
| 615 | Giant Sword | 0.420% · qty 1 | common |  |
| 761 | Battle Hammer | 0.420% · qty 1 | common |  |
| 457 | Scale Mail(M) | 0.269% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.269% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.235% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.235% · qty 1 | common |  |
| 600 | Helm(M) | 0.202% · qty 1 | common |  |
| 602 | Helm(W) | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0672% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0672% · qty 1 | common |  |
| 402 | Cape | 0.0672% · qty 1 | common |  |
| 451 | Long Boots | 0.0672% · qty 1 | common |  |
| 762 | Giant Battle Hammer | 0.0550% · qty 1 | rare |  |
| 843 | Barbarian Hammer | 0.0500% · qty 1 | rare |  |
| 853 | E.S.W.Manual | 0.0450% · qty 1 | rare |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Minotaur (id 37 · sprite `minotaurs` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-250 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Mountain Giant (id 38 · sprite `mtgiant` · gen 9)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-120 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 55 | Flameberge+1 | 0.840% · qty 1 | common |  |
| 615 | Giant Sword | 0.840% · qty 1 | common |  |
| 761 | Battle Hammer | 0.840% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 402 | Cape | 0.252% · qty 1 | common |  |
| 451 | Long Boots | 0.252% · qty 1 | common |  |
| 87 | Tower Shield | 0.252% · qty 1 | common |  |
| 86 | Knight Shield | 0.252% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.168% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.168% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.168% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.168% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 762 | Giant Battle Hammer | 0.0550% · qty 1 | rare |  |
| 857 | I.M.CManual | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Nizie (id 39 · sprite `nizie` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-250 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 732 | Dark Mage Magic Staff W | 0.110% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Orc (id 40 · sprite `orc` · gen 2)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-34 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 206 | Orc Meat | 2.27% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 207 | Orc Leather | 1.25% · qty 1 | common |  |
| 208 | Orc Teeth | 1.19% · qty 1 | common |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 12 | Main Gauche | 0.336% · qty 1 | common |  |
| 15 | Gradius | 0.336% · qty 1 | common |  |
| 65 | Sexon Axe | 0.336% · qty 1 | common |  |
| 62 | Tomahoc | 0.336% · qty 1 | common |  |
| 23 | Sabre | 0.336% · qty 1 | common |  |
| 31 | Esterk | 0.336% · qty 1 | common |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Dire Boar (id 41 · sprite `direboar` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-150 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Fire Wyvern (id 43 · sprite `firewyvern` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-1000 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Wyvern (id 44 · sprite `wyvern` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-900 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Lich (id 46 · sprite `liche` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-150 | gold |  |
| 380 | Ice Storm Manual | 6.70% · qty 1 | legendary |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 382 | Bloody Shock W.Manual | 0.0400% · qty 1 | rare |  |
| 857 | I.M.CManual | 0.0350% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Ogre (id 47 · sprite `orge` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-80 | gold |  |
| 209 | Ogre Hair | 5.00% · qty 1 | common |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Scorpion (id 50 · sprite `scp` · gen 2)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-30 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 216 | Scorpion Meat | 1.00% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 218 | Scorpion Skin | 0.500% · qty 1 | common |  |
| 215 | Scorpion Pincers | 0.400% · qty 1 | common |  |
| 217 | Scorpion Sting | 0.400% · qty 1 | common |  |
| 12 | Main Gauche | 0.336% · qty 1 | common |  |
| 15 | Gradius | 0.336% · qty 1 | common |  |
| 65 | Sexon Axe | 0.336% · qty 1 | common |  |
| 62 | Tomahoc | 0.336% · qty 1 | common |  |
| 23 | Sabre | 0.336% · qty 1 | common |  |
| 31 | Esterk | 0.336% · qty 1 | common |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Skeleton (id 51 · sprite `ske` · gen 2)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-30 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 219 | Skeleton Bones | 2.50% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 12 | Main Gauche | 0.336% · qty 1 | common |  |
| 15 | Gradius | 0.336% · qty 1 | common |  |
| 65 | Sexon Axe | 0.336% · qty 1 | common |  |
| 62 | Tomahoc | 0.336% · qty 1 | common |  |
| 23 | Sabre | 0.336% · qty 1 | common |  |
| 31 | Esterk | 0.336% · qty 1 | common |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Stalker (id 53 · sprite `stalker` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-150 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 852 | Cancel Manual | 0.150% · qty 1 | legendary |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Tigerworm (id 55 · sprite `tigerworm` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-800 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 614 | Swordof Ice Elemental | 2.50% · qty 1 | rare |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 633 | Ringof Demonpower | 0.0550% · qty 1 | rare |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 630 | Ringofthe Xelima | 0.0500% · qty 1 | legendary |  |
| 735 | Ringof Dragonpower | 0.0500% · qty 1 | rare |  |
| 620 | Merien Shield | 0.0450% · qty 1 | legendary |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 860 | Necklace Of Xelima | 0.0400% · qty 1 | legendary |  |
| 621 | Merien Plate Mail M | 0.0350% · qty 1 | legendary |  |
| 622 | Merien Plate Mail W | 0.0350% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Troll (id 58 · sprite `troll` · gen 5)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-80 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 222 | Troll Heart | 2.90% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 31 | Esterk | 0.504% · qty 1 | common |  |
| 34 | Rapier | 0.504% · qty 1 | common |  |
| 72 | War Axe+1 | 0.504% · qty 1 | common |  |
| 844 | Black Shadow Sword | 0.504% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 455 | Leather Armor(M) | 0.129% · qty 1 | common |  |
| 475 | Leather Armor(W) | 0.129% · qty 1 | common |  |
| 87 | Tower Shield | 0.129% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.129% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.129% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.129% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.129% · qty 1 | common |  |
| 590 | Robe(M) | 0.129% · qty 1 | common |  |
| 591 | Robe(W) | 0.129% · qty 1 | common |  |
| 473 | Bodice(W) | 0.129% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.129% · qty 1 | common |  |
| 484 | Tunic(M) | 0.129% · qty 1 | common |  |
| 479 | Skirt(W) | 0.129% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Unicorn (id 59 · sprite `unicorn` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-250 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 546 | Unicorn Meat | 0.200% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 547 | Unicorn Leather | 0.100% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 849 | Kloness Blade | 0.0500% · qty 1 | legendary |  |
| 850 | Kloness Axe | 0.0500% · qty 1 | legendary |  |
| 851 | Kloness Esterk | 0.0500% · qty 1 | legendary |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 545 | Unicorn Horn | 0.0400% · qty 1 | common |  |
| 859 | Necklace Of Kloness | 0.0400% · qty 1 | legendary |  |
| 620 | Merien Shield | 0.0400% · qty 1 | legendary |  |
| 863 | Kloness Wand(MS.20) | 0.0350% · qty 1 | legendary |  |
| 864 | Kloness Wand(MS.10) | 0.0350% · qty 1 | legendary |  |
| 621 | Merien Plate Mail M | 0.0350% · qty 1 | legendary |  |
| 622 | Merien Plate Mail W | 0.0350% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 544 | Unicorn Heart | 0.0067% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Werewolf (id 60 · sprite `werewolf` · gen 6)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-160 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 550 | Werewolf Meat | 1.00% · qty 1 | common |  |
| 548 | Werewolf Heart | 0.890% · qty 1 | common |  |
| 552 | Werewolf Teeth | 0.890% · qty 1 | common |  |
| 554 | Werewolf Claw | 0.890% · qty 1 | common |  |
| 551 | Werewolf Tail | 0.830% · qty 1 | common |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 553 | Werewolf Leather | 0.710% · qty 1 | common |  |
| 549 | Werewolf Nail | 0.530% · qty 1 | common |  |
| 257 | Magic Wand(MS10) | 0.504% · qty 1 | common |  |
| 47 | Claymore+1 | 0.336% · qty 1 | common |  |
| 51 | Great Sword+1 | 0.336% · qty 1 | common |  |
| 55 | Flameberge+1 | 0.336% · qty 1 | common |  |
| 34 | Rapier | 0.336% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.336% · qty 1 | common |  |
| 848 | Lighting Blade | 0.336% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.140% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.140% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.140% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.140% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.140% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.140% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 750 | Horned-Helm(M) | 0.0350% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0350% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0350% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0350% · qty 1 | common |  |
| 752 | Wizard-Cap(M) | 0.0350% · qty 1 | common |  |
| 753 | Wizard-Hat(M) | 0.0350% · qty 1 | common |  |
| 756 | Wizard-Cap(W) | 0.0350% · qty 1 | common |  |
| 757 | Wizard-Hat(W) | 0.0350% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Zombie (id 61 · sprite `zom` · gen 2)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-32 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 12 | Main Gauche | 0.336% · qty 1 | common |  |
| 15 | Gradius | 0.336% · qty 1 | common |  |
| 65 | Sexon Axe | 0.336% · qty 1 | common |  |
| 62 | Tomahoc | 0.336% · qty 1 | common |  |
| 23 | Sabre | 0.336% · qty 1 | common |  |
| 31 | Esterk | 0.336% · qty 1 | common |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Goblin (id 9901 · sprite `orc` · gen 2)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-34 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 206 | Orc Meat | 2.27% · qty 1 | common |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 207 | Orc Leather | 1.25% · qty 1 | common |  |
| 208 | Orc Teeth | 1.19% · qty 1 | common |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 258 | Magic Wand(MS0) | 0.504% · qty 1 | common |  |
| 12 | Main Gauche | 0.336% · qty 1 | common |  |
| 15 | Gradius | 0.336% · qty 1 | common |  |
| 65 | Sexon Axe | 0.336% · qty 1 | common |  |
| 62 | Tomahoc | 0.336% · qty 1 | common |  |
| 23 | Sabre | 0.336% · qty 1 | common |  |
| 31 | Esterk | 0.336% · qty 1 | common |  |
| 79 | Wood Shield | 0.202% · qty 1 | common |  |
| 81 | Targe Shield | 0.202% · qty 1 | common |  |
| 453 | Shirt(M) | 0.168% · qty 1 | common |  |
| 471 | Shirt(W) | 0.168% · qty 1 | common |  |
| 470 | Chemise(W) | 0.134% · qty 1 | common |  |
| 459 | Trousers(M) | 0.134% · qty 1 | common |  |
| 480 | Trousers(W) | 0.134% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 473 | Bodice(W) | 0.101% · qty 1 | common |  |
| 484 | Tunic(M) | 0.101% · qty 1 | common |  |
| 479 | Skirt(W) | 0.101% · qty 1 | common |  |
| 460 | Knee Trousers(M) | 0.0840% · qty 1 | common |  |
| 481 | Knee Trousers(W) | 0.0840% · qty 1 | common |  |
| 474 | Long Bodice(W) | 0.0672% · qty 1 | common |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Earth Dragon (id 110 · sprite `barlog` · gen 7)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-300 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 382 | Bloody Shock W.Manual | 1.20% · qty 1 | rare |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 47 | Claymore+1 | 0.504% · qty 1 | common |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 54 | Flameberge | 0.504% · qty 1 | common |  |
| 74 | 4Blade Golden Axe | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 86 | Knight Shield | 0.280% · qty 1 | common |  |
| 87 | Tower Shield | 0.280% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.140% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.140% · qty 1 | common |  |
| 600 | Helm(M) | 0.140% · qty 1 | common |  |
| 602 | Helm(W) | 0.140% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.140% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.140% · qty 1 | common |  |
| 732 | Dark Mage Magic Staff W | 0.110% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 457 | Scale Mail(M) | 0.0467% · qty 1 | common |  |
| 477 | Scale Mail(W) | 0.0467% · qty 1 | common |  |
| 454 | Hauberk(M) | 0.0467% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.0467% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0467% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0467% · qty 1 | common |  |
| 850 | Kloness Axe | 0.0450% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Illusion Dragon (id 111 · sprite `wyvern` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-900 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Lightning Dragon (id 112 · sprite `firewyvern` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-1000 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

### Black Dragon (id 114 · sprite `wyvern` · gen 8)

| itemId | name | chance | tier | notes |
|--------|------|--------|------|-------|
| 90 | Gold | 21.00% · qty 1-900 | gold |  |
| 95 | Green Potion | 3.28% · qty 1 | consumable |  |
| 93 | Blue Potion | 1.57% · qty 1 | consumable |  |
| 96 | Big Green Potion | 1.57% · qty 1 | consumable |  |
| 92 | Big Red Potion | 1.57% · qty 1 | consumable |  |
| 91 | Red Potion | 1.05% · qty 1-2 | consumable |  |
| 94 | Big Blue Potion | 0.735% · qty 1 | consumable |  |
| 50 | Great Sword | 0.504% · qty 1 | common |  |
| 560 | Battle Axe | 0.504% · qty 1 | common |  |
| 615 | Giant Sword | 0.504% · qty 1 | common |  |
| 56 | Flameberge+2 | 0.504% · qty 1 | common |  |
| 256 | Magic Wand(MS20) | 0.504% · qty 1 | common |  |
| 402 | Cape | 0.202% · qty 1 | common |  |
| 451 | Long Boots | 0.202% · qty 1 | common |  |
| 390 | Power Green Potion | 0.105% · qty 1 | consumable |  |
| 780 | Red Candy | 0.105% · qty 1 | consumable |  |
| 781 | Blue Candy | 0.105% · qty 1 | consumable |  |
| 782 | Green Candy | 0.105% · qty 1 | consumable |  |
| 970 | Crit Candy | 0.105% · qty 1 | consumable |  |
| 454 | Hauberk(M) | 0.101% · qty 1 | common |  |
| 472 | Hauberk(W) | 0.101% · qty 1 | common |  |
| 461 | Chain Hose(M) | 0.0840% · qty 1 | common |  |
| 482 | Chain Hose(W) | 0.0840% · qty 1 | common |  |
| 456 | Chain Mail(M) | 0.0840% · qty 1 | common |  |
| 476 | Chain Mail(W) | 0.0840% · qty 1 | common |  |
| 458 | Plate Mail(M) | 0.0840% · qty 1 | common |  |
| 478 | Plate Mail(W) | 0.0840% · qty 1 | common |  |
| 685 | Wizard Robe(M) | 0.0672% · qty 1 | common |  |
| 686 | Wizard Robe(W) | 0.0672% · qty 1 | common |  |
| 601 | Full Helm(M) | 0.0672% · qty 1 | common |  |
| 603 | Full Helm(W) | 0.0672% · qty 1 | common |  |
| 85 | Lagi Shield | 0.0672% · qty 1 | common |  |
| 86 | Knight Shield | 0.0672% · qty 1 | common |  |
| 87 | Tower Shield | 0.0672% · qty 1 | common |  |
| 750 | Horned-Helm(M) | 0.0504% · qty 1 | common |  |
| 751 | Wings-Helm(M) | 0.0504% · qty 1 | common |  |
| 754 | Horned-Helm(W) | 0.0504% · qty 1 | common |  |
| 755 | Wings-Helm(W) | 0.0504% · qty 1 | common |  |
| 846 | The_Devastator | 0.0400% · qty 1 | legendary |  |
| 391 | Super Green Potion | 0.0210% · qty 1 | consumable |  |
| 650 | Zemstoneof Sacrifice | 0.0210% · qty 1 | stone |  |
| 656 | Stone Of Xelima | 0.0210% · qty 1 | stone |  |
| 657 | Stone Of Merien | 0.0210% · qty 1 | stone |  |
| 868 | Acient Tablet(LU) | 0.0210% · qty 1 | common |  |
| 869 | Acient Tablet(LD) | 0.0210% · qty 1 | common |  |
| 870 | Acient Tablet(RU) | 0.0210% · qty 1 | common |  |
| 871 | Acient Tablet(RD) | 0.0210% · qty 1 | common |  |
| 651 | Green Ball | 0.0042% · qty 1 | common |  |
| 652 | Red Ball | 0.0042% · qty 1 | common |  |
| 653 | Yellow Ball | 0.0042% · qty 1 | common |  |
| 654 | Blue Ball | 0.0042% · qty 1 | common |  |
| 655 | Pearl Ball | 0.0042% · qty 1 | common |  |

## Ettin focus (gen 10)

| item | tier | chance | Olympia role |
|------|------|--------|--------------|
| Gold | gold | 21.00% | gold path ~21% |
| Green Potion | consumable | 3.28% | standard / gear |
| Blue Potion | consumable | 1.57% | standard / gear |
| Big Green Potion | consumable | 1.57% | standard / gear |
| Big Red Potion | consumable | 1.57% | standard / gear |
| Red Potion | consumable | 1.05% | standard / gear |
| Big Blue Potion | consumable | 0.735% | standard / gear |
| Bloody Shock W.Manual | rare | 0.430% | standard / gear |
| Great Sword | common | 0.420% | standard / gear |
| Great Sword+1 | common | 0.420% | standard / gear |
| Flameberge+1 | common | 0.420% | standard / gear |
| Flameberge+2 | common | 0.420% | standard / gear |
| Giant Sword | common | 0.420% | standard / gear |
| Battle Hammer | common | 0.420% | standard / gear |
| Scale Mail(M) | common | 0.269% | standard / gear |
| Scale Mail(W) | common | 0.269% | standard / gear |
| Plate Mail(M) | common | 0.235% | standard / gear |
| Plate Mail(W) | common | 0.235% | standard / gear |
| Helm(M) | common | 0.202% | standard / gear |
| Helm(W) | common | 0.202% | standard / gear |
| E.S.W.Manual | rare | 0.130% | RARE manual (E.S.W.) |
| Power Green Potion | consumable | 0.105% | standard / gear |
| Red Candy | consumable | 0.105% | standard / gear |
| Blue Candy | consumable | 0.105% | standard / gear |
| Green Candy | consumable | 0.105% | standard / gear |
| Crit Candy | consumable | 0.105% | standard / gear |
| Horned-Helm(M) | common | 0.0672% | standard / gear |
| Wings-Helm(M) | common | 0.0672% | standard / gear |
| Cape | common | 0.0672% | standard / gear |
| Long Boots | common | 0.0672% | standard / gear |
| Giant Battle Hammer | rare | 0.0550% | RARE weapon (Giant BH) |
| Barbarian Hammer | rare | 0.0500% | RARE weapon (Barbarian Hammer) |
| Ringof Dragonpower | rare | 0.0420% | standard / gear |
| Super Green Potion | consumable | 0.0210% | standard / gear |
| Zemstoneof Sacrifice | stone | 0.0210% | standard / gear |
| Stone Of Xelima | stone | 0.0210% | standard / gear |
| Stone Of Merien | stone | 0.0210% | standard / gear |
| Acient Tablet(LU) | common | 0.0210% | standard / gear |
| Acient Tablet(LD) | common | 0.0210% | standard / gear |
| Acient Tablet(RU) | common | 0.0210% | standard / gear |
| Acient Tablet(RD) | common | 0.0210% | standard / gear |
| Green Ball | common | 0.0042% | standard / gear |
| Red Ball | common | 0.0042% | standard / gear |
| Yellow Ball | common | 0.0042% | standard / gear |
| Blue Ball | common | 0.0042% | standard / gear |
| Pearl Ball | common | 0.0042% | standard / gear |

## Summary

- Monsters audited (Olympia-mapped with loot): **46**
- Generator: `sp-client/tools/generate-monster-loot.mjs` (merge keeps CL-invented extras)
- Giant Battle Hammer **762** = **rare** (not common gear share)
