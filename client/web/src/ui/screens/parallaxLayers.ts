// Couches officielles de Parallax de Dofus 3 Unity
export type ParallaxLayer = {
  name: string
  file: string
  parentChain: string[]
  pos: { x: number; y: number }
  size: { x: number; y: number }
  pivot: { x: number; y: number }
  anchorMin: { x: number; y: number }
  anchorMax: { x: number; y: number }
  color: { r: number; g: number; b: number; a: number }
}

export const LOGIN_PARALLAX_LAYERS: ParallaxLayer[] = [
  {name:"background",file:"background.png",parentChain:["ParallaxBackground"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"background_vignetting",file:"background_vignetting.png",parentChain:["ParallaxBackground"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_2",file:"cloud_2.png",parentChain:["ParallaxBackground","clouds","left_1"],pos:{x:-488,y:-71},size:{x:624,y:330},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:.87}},
  {name:"cloud_4",file:"cloud_4.png",parentChain:["ParallaxBackground","clouds","left_1"],pos:{x:-490,y:-324},size:{x:1368,y:335},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_7",file:"cloud_7.png",parentChain:["ParallaxBackground","clouds","left_1"],pos:{x:-518,y:228},size:{x:867,y:461},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_9",file:"cloud_9.png",parentChain:["ParallaxBackground","clouds","left_2"],pos:{x:-181,y:428},size:{x:867,y:461},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_11",file:"cloud_11.png",parentChain:["ParallaxBackground","clouds","left_2"],pos:{x:-462,y:-122},size:{x:1523,y:269},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_5",file:"cloud_5.png",parentChain:["ParallaxBackground","clouds","left_3"],pos:{x:-552,y:17},size:{x:948,y:441},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_6",file:"cloud_6.png",parentChain:["ParallaxBackground","clouds","left_3"],pos:{x:-514,y:32},size:{x:867,y:461},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_1",file:"cloud_1.png",parentChain:["ParallaxBackground","clouds","right_1"],pos:{x:174,y:112},size:{x:866,y:448},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_3",file:"cloud_3.png",parentChain:["ParallaxBackground","clouds","right_1"],pos:{x:606,y:-24},size:{x:624,y:330},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_8",file:"cloud_8.png",parentChain:["ParallaxBackground","clouds","right_2"],pos:{x:354,y:314},size:{x:867,y:461},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_10",file:"cloud_10.png",parentChain:["ParallaxBackground","clouds","right_2"],pos:{x:133,y:21},size:{x:1033,y:471},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cloud_12",file:"cloud_12.png",parentChain:["ParallaxBackground","clouds","right_2"],pos:{x:419,y:16},size:{x:1523,y:269},pivot:{x:.5,y:.5},anchorMin:{x:.5,y:.5},anchorMax:{x:.5,y:.5},color:{r:1,g:1,b:1,a:1}},
  {name:"cone_of_light",file:"cone_of_light.png",parentChain:["ParallaxBackground"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"shadow_right",file:"shadow_right.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"shadow_middle",file:"shadow_middle.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"shadow_left",file:"shadow_left.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"smoke_shadow_right",file:"smoke_shadow_right.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"archi_back",file:"archi_back.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:.44,g:.44,b:.44,a:1}},
  {name:"mountains",file:"mountains.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"archi_right_2",file:"archi_right_2.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"archi_left",file:"archi_left.png",parentChain:["ParallaxBackground","elements"],pos:{x:-7,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"archi_right_1",file:"archi_right_1.png",parentChain:["ParallaxBackground","elements"],pos:{x:61,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"ground",file:"ground.png",parentChain:["ParallaxBackground","elements"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"front-right",file:"front-right.png",parentChain:["ParallaxBackground","elements"],pos:{x:44,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"front-left",file:"front-left.png",parentChain:["ParallaxBackground","elements"],pos:{x:-98,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"smoke_1",file:"smoke_1.png",parentChain:["ParallaxBackground","smoke"],pos:{x:-1461,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"smoke_2",file:"smoke_2.png",parentChain:["ParallaxBackground","smoke"],pos:{x:-1461,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"godrays",file:"godrays.png",parentChain:["ParallaxBackground"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}},
  {name:"fade",file:"fade.png",parentChain:["ParallaxBackground"],pos:{x:0,y:0},size:{x:0,y:0},pivot:{x:.5,y:.5},anchorMin:{x:0,y:0},anchorMax:{x:1,y:1},color:{r:1,g:1,b:1,a:1}}
]
