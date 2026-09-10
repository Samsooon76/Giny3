import { useState } from 'react'
import type { BindingResolver } from '../official/types'
import type { Repeater } from '../official/repeaters'
import { useReferenceCatalog } from './referenceCatalog'
/** The storefront uses a remote service in the official client. Catalogue
 * cards below are explicitly preview-only; no prices or purchases are invented. */
export function useShop(active:boolean){
 const data=useReferenceCatalog(active),[tab,setTab]=useState(1),[query,setQuery]=useState(''),[category,setCategory]=useState(0)
 const preview=new URLSearchParams(location.search).has('ui-preview')
 const rows=preview?(data.companions??[]).slice(0,8).filter(r=>r.name?.toLocaleLowerCase('fr').includes(query.toLocaleLowerCase('fr'))):[]
 const resolve:BindingResolver=b=>{
  if(b==='header_titleLabel')return {text:'Bourse aux Kamas / Boutique / Cadeaux'}
  if(b==='ctr_links'||b==='ctr_subscribed'||b==='ctr_kamasTemporaryAmount'||b==='ctr_linkedOgrines'||b==='cf_kamasAmount')return {hidden:true}
  if(b==='ctr_notSubscribed')return {hidden:false}
  if(b==='lbl_noSubscription')return {text:'Aucun abonnement en cours'}
  if(b==='dd_sort')return {text:'Pertinence'}
  if(b==='cf_ogrinesAmount')return {text:'0'}
  if(b==='btn_subscribe')return {disabled:true}
  if(b==='inp_search')return {text:query,placeholder:'Rechercher dans la boutique',onInput:e=>setQuery(e.target.value)}
  if(['ctr_articlePage','sv_search','btn_return'].includes(b))return {hidden:true}
  if(b==='ctr_catalog')return {hidden:false}
  if(b==='ctr_catalogContent')return {style:{display:'flex',flexDirection:'row',flexWrap:'wrap',gap:20,padding:20}}
  if(b==='ctr_carousel')return {hidden:!preview,style:{height:220,backgroundSize:'cover'},sprite:'/game-data/client/illustrations/companions/big_6.png'}
  if(b==='ctr_noSearchResult')return {hidden:rows.length>0}
  if(b==='lbl_noSearchResult')return {text:preview?'Aucun article ne correspond à la recherche.':'La boutique n’est pas encore connectée au catalogue du serveur.'}
  return undefined
 }
 const repeaters:Repeater={tabGroup:['BOURSE AUX KAMAS ET OGRINES','BOUTIQUE','ACHATS / CODES / CADEAUX'].map((label,i)=>({key:String(i),template:'DofusTab',resolve:b=>b==='tab_label'?{text:label}:!b?{className:tab===i?'activeTrue':'activeFalse',onClick:()=>setTab(i)}:undefined})),ctr_tabContent:[{key:String(tab),template:['bakTab','Shop','webCodesAndGifts'][tab],resolve,repeaters:{sv_categories:['TOUTE LA BOUTIQUE','PROMOTIONS DE LA SEMAINE','ABONNEMENTS','OGRINES','SERVICES','OFFRES DU MOMENT','LES INDÉMODABLES','COLLECTION ÉTÉ','APPARENCES DE CLASSES','MARCHÉ AUX PUCES'].map((label,i)=>({key:String(i),template:'GenericFilterCategory',resolve:b=>b==='filter_title'?{text:label}:b==='filter_header'?{onClick:()=>setCategory(i),style:{height:40,background:category===i?'#777598':undefined}}:['filter_options','filter_toggle'].includes(b)?{hidden:true}:undefined})),ctr_catalogContent:rows.map(r=>({key:String(r.id),template:'ArticleTile',resolve:b=>b==='ctr_shopTile'?{style:{width:'calc(25% - 15px)',height:330}}:b==='ctr_image'?{sprite:`/game-data/client/illustrations/companions/big_${r.assetId}.png`}:b==='lbl_name'?{text:r.name}:b==='ctr_prices'?{text:'Aperçu',replaceChildren:true}:['ctr_timer','ctr_link','ctr_bannerOffer','ctr_disabledArticle'].includes(b)?{hidden:true}:undefined}))}}]}
 return {resolve,repeaters}
}
