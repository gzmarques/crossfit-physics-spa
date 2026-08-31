import type { MovimentoConfig } from '../types';

export const movimentosDB: Record<string, MovimentoConfig> = {
  // === EMPURRADA BW ===
  'pushup': { nome: 'Push-ups', grupo: 'Empurrada BW', categoria: 'alavanca_parcial', usaCarga: false, estilosPermitidos: ['normal'] },
  'ring_dip': { nome: 'Ring Dip', grupo: 'Empurrada BW', categoria: 'vertical_bw', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  'bar_dip': { nome: 'Bar Dip', grupo: 'Empurrada BW', categoria: 'vertical_bw', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  'hspu': { nome: 'Handstand Push-up (HSPU)', grupo: 'Empurrada BW', categoria: 'vertical_bw', usaCarga: false, estilosPermitidos: ['kipping', 'strict'], paramExtra: { label: 'Déficit (m)', val: '0', type: 'number' } },
  'wf_hspu': { nome: 'Wall-Facing HSPU', grupo: 'Ginástica de Elite', categoria: 'wf_hspu', usaCarga: false, estilosPermitidos: ['strict'] },
  'free_hspu': { nome: 'Freestanding HSPU', grupo: 'Ginástica de Elite', categoria: 'free_hspu', usaCarga: false, estilosPermitidos: ['strict'] },
  'handstand_walk': { nome: 'Handstand Walk', grupo: 'Empurrada BW', categoria: 'hs_walk', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Trecho (m)', val: '10', type: 'number' } },
  'hs_stairs_up': { nome: 'HS Stairs Ascent', grupo: 'Empurrada BW', categoria: 'hs_incline_up', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Trecho;Alt (m)', val: '5;1', type: 'text' } },
  'hs_stairs_down': { nome: 'HS Stairs Descent', grupo: 'Empurrada BW', categoria: 'hs_incline_down', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Trecho;Alt (m)', val: '5;1', type: 'text' } },
  'hs_ramp_up': { nome: 'HS Ramp Ascent', grupo: 'Empurrada BW', categoria: 'hs_incline_up', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Trecho;Alt (m)', val: '5;1', type: 'text' } },
  'hs_ramp_down': { nome: 'HS Ramp Descent', grupo: 'Empurrada BW', categoria: 'hs_incline_down', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Trecho;Alt (m)', val: '5;1', type: 'text' } },
  'wall_walk': { nome: 'Wall Walk', grupo: 'Empurrada BW', categoria: 'wall_walk', usaCarga: false, estilosPermitidos: ['normal'] },
  
  // === EMPURRADA CARGA ===
  'bench_press': { nome: 'Bench Press', grupo: 'Empurrada Carga', categoria: 'bench_press', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'push_press': { nome: 'Push Press', grupo: 'Empurrada Carga', categoria: 'lpo_jerk', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'db_strict_press': { nome: 'Dumbbell Strict Press', grupo: 'LPO Assimétrico', categoria: 'db_press', usaCarga: true, estilosPermitidos: ['normal', 'tng'] },
  
  // === PUXADA BW E GINÁSTICA AVANÇADA ===
  'ring_row': { nome: 'Ring Row', grupo: 'Puxada BW', categoria: 'alavanca_parcial', usaCarga: false, estilosPermitidos: ['normal'] },
  'bulgarian_row_floor': { nome: 'Bulgarian Row (Chão)', grupo: 'Puxada BW', categoria: 'alavanca_parcial', usaCarga: false, estilosPermitidos: ['normal'] },
  'bulgarian_row_susp': { nome: 'Bulgarian Row (Suspensão)', grupo: 'Puxada BW', categoria: 'alavanca_horizontal', usaCarga: false, estilosPermitidos: ['normal'] },
  'pullup': { nome: 'Pull-up', grupo: 'Puxada BW', categoria: 'vertical_bw', usaCarga: false, estilosPermitidos: ['kipping', 'butterfly', 'strict'] },
  'c2b': { nome: 'Chest-to-bar', grupo: 'Puxada BW', categoria: 'vertical_bw', usaCarga: false, estilosPermitidos: ['kipping', 'butterfly', 'strict'] },
  'bmu': { nome: 'Bar Muscle-up (BMU)', grupo: 'Ginástica Avançada', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  'rmu': { nome: 'Ring Muscle-up (RMU)', grupo: 'Ginástica Avançada', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  'bar_pullover': { nome: 'Bar Pullover', grupo: 'Ginástica de Elite', categoria: 'pullover', usaCarga: false, estilosPermitidos: ['normal'] },
  'rope_climb': { nome: 'Rope Climb', grupo: 'Ginástica Vertical', categoria: 'rope_climb', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Altura (m)', val: '4.5', type: 'number' } },
  'rope_climb_legless': { nome: 'Legless Rope Climb', grupo: 'Ginástica Vertical', categoria: 'rope_climb', usaCarga: false, estilosPermitidos: ['strict'], paramExtra: { label: 'Altura (m)', val: '4.5', type: 'number' } },
  'rope_ascend_floor': { nome: 'Rope Ascend (Do chão)', grupo: 'Ginástica Vertical', categoria: 'rope_ascend_floor', usaCarga: false, estilosPermitidos: ['normal'] },
  'pegboard': { nome: 'Pegboard Ascent', grupo: 'Ginástica Vertical', categoria: 'pegboard', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Altura (m)', val: '3.0', type: 'number' } },
  
  // === AGACHAMENTO BW ===
  'air_squat': { nome: 'Air Squat', grupo: 'Agachamento BW', categoria: 'squat_bw', usaCarga: false, estilosPermitidos: ['normal'] },
  'pistol_squat': { nome: 'Pistol Squat (Alt)', grupo: 'Agachamento BW', categoria: 'squat_bw', usaCarga: false, estilosPermitidos: ['normal'], isUnilateral: true },
  'box_step_up': { nome: 'Box Step-up', grupo: 'Agachamento BW', categoria: 'box_step_up', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' }, isUnilateral: true },
  'box_jump': { nome: 'Box Jump', grupo: 'Agachamento BW', categoria: 'box_jump', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' } },
  'box_jump_over': { nome: 'Box Jump Over', grupo: 'Agachamento BW', categoria: 'box_jump_over', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' } },
  
  // === AGACHAMENTO CARGA ===
  'front_squat': { nome: 'Front Squat', grupo: 'Agachamento Carga', categoria: 'squat_carga', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'back_squat': { nome: 'Back Squat', grupo: 'Agachamento Carga', categoria: 'squat_carga', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'overhead_squat': { nome: 'Overhead Squat', grupo: 'Agachamento Carga', categoria: 'squat_carga', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'db_box_step_over': { nome: 'DB Box Step-over', grupo: 'Agachamento Carga', categoria: 'box_step_up', usaCarga: true, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' }, isUnilateral: true },
  'sandbag_squat': { nome: 'Sandbag/D-Ball Squat', grupo: 'Agachamento Carga', categoria: 'squat_carga', usaCarga: true, estilosPermitidos: ['normal'] },
  
  // === LUNGES ===
  'walking_lunge': { nome: 'Walking Lunge', grupo: 'Lunges', categoria: 'lunge_bw', usaCarga: false, estilosPermitidos: ['normal'], isUnilateral: true },
  'lunge_suitcase': { nome: 'Lunge (Suitcase)', grupo: 'Lunges', categoria: 'lunge_carga', usaCarga: true, estilosPermitidos: ['normal', 'tng'], isUnilateral: true },
  'lunge_front_rack': { nome: 'Lunge (Front Rack)', grupo: 'Lunges', categoria: 'lunge_carga', usaCarga: true, estilosPermitidos: ['normal', 'tng'], isUnilateral: true },
  'lunge_overhead': { nome: 'Lunge (Overhead)', grupo: 'Lunges', categoria: 'lunge_carga', usaCarga: true, estilosPermitidos: ['normal', 'tng'], isUnilateral: true },
  
  // === LPO E FORÇA ===
  'deadlift': { nome: 'Deadlift', grupo: 'LPO / Força', categoria: 'deadlift', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'clean': { nome: 'Squat Clean', grupo: 'LPO / Força', categoria: 'lpo_floor_squat', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.85, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'clean_power': { nome: 'Power Clean', grupo: 'LPO / Força', categoria: 'lpo_floor_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.85, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'clean_hang_squat': { nome: 'Hang Squat Clean', grupo: 'LPO / Força', categoria: 'lpo_hang_squat', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.60, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'clean_hang_power': { nome: 'Hang Power Clean', grupo: 'LPO / Força', categoria: 'lpo_hang_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.60, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'clean_jerk': { nome: 'Clean & Jerk', grupo: 'LPO / Força', categoria: 'lpo_cj', usaCarga: true, estilosPermitidos: ['tng', 'drop'], paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'hang_clean_jerk': { nome: 'Hang Clean & Jerk', grupo: 'LPO / Força', categoria: 'lpo_hang_cj', usaCarga: true, estilosPermitidos: ['tng', 'drop'], paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'snatch': { nome: 'Squat Snatch', grupo: 'LPO / Força', categoria: 'lpo_floor_squat', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 1.00, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'snatch_power': { nome: 'Power Snatch', grupo: 'LPO / Força', categoria: 'lpo_floor_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 1.00, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'snatch_hang_squat': { nome: 'Hang Squat Snatch', grupo: 'LPO / Força', categoria: 'lpo_hang_squat', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.75, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'snatch_hang_power': { nome: 'Hang Power Snatch', grupo: 'LPO / Força', categoria: 'lpo_hang_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.75, paramExtra: { label: 'VBT (m/s)', val: '0', type: 'number' } },
  'push_jerk': { nome: 'Push/Split Jerk', grupo: 'LPO / Força', categoria: 'lpo_jerk', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  
  // === CARGAS IRREGULARES E ASSIMÉTRICAS ===
  'db_snatch': { nome: 'Dumbbell Snatch (Alt)', grupo: 'Cargas Irregulares', categoria: 'lpo_floor_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 1.00 },
  'db_clean': { nome: 'Dumbbell Clean', grupo: 'Cargas Irregulares', categoria: 'lpo_floor_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.85 },
  'db_hang_clean': { nome: 'Dumbbell Hang Clean', grupo: 'Cargas Irregulares', categoria: 'lpo_hang_power', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 0.60 },
  'db_jerk': { nome: 'Dumbbell Push Jerk', grupo: 'Cargas Irregulares', categoria: 'lpo_jerk', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'db_clean_jerk': { nome: 'DB Clean & Jerk', grupo: 'Cargas Irregulares', categoria: 'db_cj', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'db_hang_clean_jerk': { nome: 'DB Hang Clean & Jerk', grupo: 'Cargas Irregulares', categoria: 'db_hang_cj', usaCarga: true, estilosPermitidos: ['tng', 'drop'] },
  'sandbag_clean': { nome: 'Sandbag Clean (Ombro)', grupo: 'LPO Assimétrico', categoria: 'sandbag_clean', usaCarga: true, estilosPermitidos: ['normal', 'drop'] },
  'dball_over_shoulder': { nome: 'D-Ball/Sandbag Over Shoulder', grupo: 'Hyrox / Strongman', categoria: 'dball_shoulder', usaCarga: true, estilosPermitidos: ['normal', 'drop'], paramExtra: { label: 'Diâmetro(m)', val: '0.35', type: 'number'} },
  
  // === HÍBRIDOS COMPLEXOS ===
  'turkish_get_up': { nome: 'TGU', grupo: 'Híbridos Complexos', categoria: 'tgu', usaCarga: true, estilosPermitidos: ['normal'] },
  'thruster': { nome: 'Thruster', grupo: 'Híbridos Complexos', categoria: 'lpo_floor_squat', usaCarga: true, estilosPermitidos: ['tng', 'drop'], fatorH: 1.00 },
  'wall_ball': { nome: 'Wall Ball', grupo: 'Híbridos Complexos', categoria: 'wall_ball', usaCarga: true, estilosPermitidos: ['normal'], paramExtra: { label: 'Alvo (m)', val: '3.0', type: 'number' } }, 
  'devil_press': { nome: 'Devil Press', grupo: 'Híbridos Complexos', categoria: 'devil_press', usaCarga: true, estilosPermitidos: ['normal', 'tng'] },
  
  // === BURPEES ===
  'burpee': { nome: 'Burpee Tradicional', grupo: 'Burpees', categoria: 'vertical_hibrido', usaCarga: false, estilosPermitidos: ['normal'] },
  'burpee_line': { nome: 'Burpee Over Line', grupo: 'Burpees', categoria: 'vertical_hibrido_extra', usaCarga: false, estilosPermitidos: ['normal'] },
  'burpee_broad_jump': { nome: 'Burpee Broad Jump', grupo: 'Burpees', categoria: 'burpee_broad_jump', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Dist (m)', val: '1.5', type: 'number' } },
  'burpee_over_db': { nome: 'Burpee Over DB', grupo: 'Burpees', categoria: 'burpee_over_obj', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Alt DB(m)', val: '0.20', type: 'number' } },
  'burpee_over_kb': { nome: 'Burpee Over KB', grupo: 'Burpees', categoria: 'burpee_over_obj', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Alt KB(m)', val: '0.30', type: 'number' } },
  'burpee_box_jump': { nome: 'Burpee Box Jump', grupo: 'Burpees', categoria: 'burpee_box_jump', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' } },
  'burpee_box_jump_over': { nome: 'Burpee Box Jump Over', grupo: 'Burpees', categoria: 'burpee_box_jump_over', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Caixa(m) 0=Auto', val: '0', type: 'number' } },
  'burpee_pullup': { nome: 'Burpee Pull-up', grupo: 'Burpees', categoria: 'burpee_pullup', usaCarga: false, estilosPermitidos: ['normal'] },
  
  // === CORE BW ===
  'kb_swing_am': { nome: 'KB Swing (Amer.)', grupo: 'Hinge BW', categoria: 'arc_carga', usaCarga: true, estilosPermitidos: ['normal'] },
  'kb_swing_russo': { nome: 'KB Swing (Russo)', grupo: 'Hinge BW', categoria: 'arc_carga_parcial', usaCarga: true, estilosPermitidos: ['normal'] },
  'situp': { nome: 'Sit-up (Abmat)', grupo: 'Core BW', categoria: 'core_situp', usaCarga: false, estilosPermitidos: ['normal'] }, 
  'v_ups': { nome: 'V-Ups', grupo: 'Core BW', categoria: 'core_vup', usaCarga: false, estilosPermitidos: ['normal'] }, 
  'ghd_situp': { nome: 'GHD Sit-up', grupo: 'Core BW', categoria: 'core_ghd', usaCarga: false, estilosPermitidos: ['normal'] }, 
  'ghd_back_extension': { nome: 'GHD Hip/Back Extension', grupo: 'Core BW', categoria: 'core_ghd', usaCarga: false, estilosPermitidos: ['normal'] },
  't2b': { nome: 'Toes to Bar (T2B)', grupo: 'Core BW', categoria: 'core_t2b', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  'k2e': { nome: 'Knees to Elbows (K2E)', grupo: 'Core BW', categoria: 'core_k2e', usaCarga: false, estilosPermitidos: ['kipping', 'strict'] },
  
  // === MONOSTRUTURAL E STRONGMAN ===
  'run': { nome: 'Corrida', grupo: 'Monostrutural', categoria: 'corrida', usaCarga: false, estilosPermitidos: ['normal'] },
  'air_runner': { nome: 'Curved Treadmill (AirRunner)', grupo: 'Monostrutural', categoria: 'air_runner', usaCarga: false, estilosPermitidos: ['normal'] },
  'shuttle_run': { 
    nome: 'Shuttle Run', 
    grupo: 'Monostrutural', 
    categoria: 'shuttle_run', 
    usaCarga: false, 
    estilosPermitidos: ['normal'], 
    paramExtra: { label: 'Tiro (m)', val: '7.5', type: 'number' } 
  },
  'farmers_carry': { 
    nome: 'Farmer\'s Carry', grupo: 'Monostrutural', categoria: 'corrida_carga', usaCarga: true, estilosPermitidos: ['normal'],
    paramExtra: { label: 'Terreno (η)', val: '1.0', type: 'select', options: [ {label: 'Ginásio', value: '1.0'}, {label: 'Terra/Cascalho', value: '1.1'}, {label: 'Grama', value: '1.2'}, {label: 'Areia Solta', value: '2.1'} ] }
  }, 
  'yoke_carry': { 
    nome: 'Yoke Carry', grupo: 'Hyrox / Strongman', categoria: 'yoke_carry', usaCarga: true, estilosPermitidos: ['normal'],
    paramExtra: { label: 'Terreno (η)', val: '1.0', type: 'select', options: [ {label: 'Ginásio', value: '1.0'}, {label: 'Terra/Cascalho', value: '1.1'}, {label: 'Grama', value: '1.2'}, {label: 'Areia Solta', value: '2.1'} ] }
  },
  'sled_push': { 
    nome: 'Sled Push', grupo: 'Monostrutural', categoria: 'friccao_horizontal_push', usaCarga: true, estilosPermitidos: ['normal'],
    paramExtra: { label: 'Superfície (μ)', val: '0.35', type: 'select', options: [ {label: 'Grama Sintética', value: '0.35'}, {label: 'Grama Natural', value: '0.50'}, {label: 'Asfalto', value: '0.65'}, {label: 'Emborrachado', value: '0.85'} ] } 
  }, 
  'sled_pull': { 
    nome: 'Sled Pull', grupo: 'Monostrutural', categoria: 'friccao_horizontal_pull', usaCarga: true, estilosPermitidos: ['normal'],
    paramExtra: { label: 'Superfície (μ)', val: '0.35', type: 'select', options: [ {label: 'Grama Sintética', value: '0.35'}, {label: 'Grama Natural', value: '0.50'}, {label: 'Asfalto', value: '0.65'}, {label: 'Emborrachado', value: '0.85'} ] } 
  }, 
  'heavy_sled_pull': { 
    nome: 'Heavy Sled Pull', grupo: 'Hyrox / Strongman', categoria: 'friccao_horizontal_pull_heavy', usaCarga: true, estilosPermitidos: ['normal'],
    paramExtra: { label: 'Superfície (μ)', val: '0.35', type: 'select', options: [ {label: 'Grama Sintética', value: '0.35'}, {label: 'Grama Natural', value: '0.50'}, {label: 'Asfalto', value: '0.65'}, {label: 'Emborrachado', value: '0.85'} ] } 
  },
  
  // === ERGÔMETROS ===
  'row': { 
    nome: 'Remo (Concept2)', grupo: 'Ergômetros', categoria: 'remo', usaCarga: false, estilosPermitidos: ['normal'], 
    paramExtra: { label: 'Unidade', val: 'm', type: 'select', options: [{label: 'Metros (m)', value: 'm'}, {label: 'Calorias (cal)', value: 'cal'}] } 
  },
  'skierg': { 
    nome: 'SkiErg (Concept2)', grupo: 'Ergômetros', categoria: 'remo', usaCarga: false, estilosPermitidos: ['normal'], 
    paramExtra: { label: 'Unidade', val: 'm', type: 'select', options: [{label: 'Metros (m)', value: 'm'}, {label: 'Calorias (cal)', value: 'cal'}] } 
  },
  'bike_erg': { 
    nome: 'BikeErg (Concept2)', grupo: 'Ergômetros', categoria: 'bike', usaCarga: false, estilosPermitidos: ['normal'], 
    paramExtra: { label: 'RPM', val: '70', type: 'number' },
    paramExtra2: { label: 'Unidade', val: 'm', type: 'select', options: [{label: 'Metros', value: 'm'}, {label: 'Calorias', value: 'cal'}] }
  },
  'echo_bike': { 
    nome: 'Rogue Echo Bike', grupo: 'Ergômetros', categoria: 'echo_bike', usaCarga: false, estilosPermitidos: ['normal'], 
    paramExtra: { label: 'RPM', val: '60', type: 'number' },
    paramExtra2: { label: 'Unidade', val: 'cal', type: 'select', options: [{label: 'Calorias', value: 'cal'}, {label: 'Metros', value: 'm'}] }
  },
  'assault_bike': { 
    nome: 'Assault AirBike', grupo: 'Ergômetros', categoria: 'assault_bike', usaCarga: false, estilosPermitidos: ['normal'], 
    paramExtra: { label: 'RPM', val: '60', type: 'number' },
    paramExtra2: { label: 'Unidade', val: 'cal', type: 'select', options: [{label: 'Calorias', value: 'cal'}, {label: 'Metros', value: 'm'}] }
  },
  // === PULOS DE CORDA ===
  'single_under': { nome: 'Single-unders', grupo: 'Corda', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Salto(m)', val: '0.05', type: 'number'} },
  'su_crossover': { nome: 'SU Crossover', grupo: 'Corda', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Salto(m)', val: '0.08', type: 'number'} },
  'double_under': { nome: 'Double-unders', grupo: 'Corda', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Salto(m)', val: '0.12', type: 'number'} },
  'du_crossover': { nome: 'DU Crossover', grupo: 'Corda', categoria: 'vertical_bw_total', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Salto(m)', val: '0.15', type: 'number'} },
  'heavy_du': { nome: 'Heavy Rope Double-Unders', grupo: 'Corda', categoria: 'heavy_du', usaCarga: false, estilosPermitidos: ['normal'], paramExtra: { label: 'Massa Corda(kg)', val: '1.5', type: 'number'} }
};