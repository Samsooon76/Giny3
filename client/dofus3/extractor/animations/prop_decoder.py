"""Flag-based Animator2D reader for map props; actor decoding remains independent."""
import struct
from copy import deepcopy
from .decoder import DecodeError, NodeState, prop_node_color

def decode_prop_frames(data: bytes):
    try:return _decode(data)
    except (struct.error, IndexError) as e:raise DecodeError('Truncated prop animation') from e

def _decode(data):
    frames,nodes,events,flags=struct.unpack_from('<4H',data);p=8;labels=[]
    for _ in range(events):
        frame,length=struct.unpack_from('<HB',data,p);p+=3
        labels.append({'frame':frame,'text':data[p:p+length].decode('utf8','replace')});p=(p+length+1)&~1
    p=(p+3)&~3;offsets=struct.unpack_from('<'+'I'*frames,data,p);p+=frames*4
    if not frames or offsets[0]!=p:raise DecodeError('Invalid prop frame table')
    states={};result=[];order=None
    for fi,start in enumerate(offsets):
        p=start;snapshot=[];seen=[];end=offsets[fi+1] if fi+1<frames else len(data)
        for _ in range(nodes):
            node,tag,alpha=struct.unpack_from('<HBB',data,p);p+=4
            if node>=nodes or node in seen:raise DecodeError('Invalid prop node index')
            seen.append(node)
            st=states.setdefault(node,{'graphic':-1,'matrix':[1.,0.,0.,0.,1.,0.],'mask':0,'color':None})
            if tag&33:
                st['graphic'],st['customisation']=struct.unpack_from('<hh',data,p);p=(p+9)&~3
            colors=[]
            if tag&4:colors.append(struct.unpack_from('<I',data,p)[0]);p+=4
            if tag&8:colors.append(struct.unpack_from('<I',data,p)[0]);p+=4
            if tag&16:st['matrix']=list(struct.unpack_from('<6f',data,p));p+=24
            if tag&64:st['mask']=data[p];p+=4
            if tag&128:
                ext,blend=struct.unpack_from('<BB',data,p);p+=4
                st['blend']=blend
                matrix=None
                if ext&64:
                    matrix=list(struct.unpack_from('<20f',data,p));p+=80
                    st['color_matrix']=matrix
                filters=data[p];p+=1
                decoded=[]
                for _ in range(filters):
                    kind=data[p];p=(p+4)&~3
                    if kind==64:
                        if not ext&64:raise DecodeError('Color matrix filter without inline matrix')
                        decoded.append({'kind':64,'matrix':matrix})
                    elif kind in (1,2,4):
                        size={1:32,2:12,4:24}[kind]
                        payload=data[p:p+size];p+=size
                        decoded.append({'kind':kind,'payload_hex':payload.hex()})
                    else:raise DecodeError(f'Unknown prop filter {kind}')
                st['filters']=decoded
                p=(p+3)&~3
            if p>end:raise DecodeError('Prop record overruns frame')
            st['color']=prop_node_color(st['color'],tag,alpha,colors)
            snapshot.append(NodeState(node=node,tag=tag,extra=alpha,transform=st['matrix'][:],
                customisation=st.get('customisation',-1),graphic=str(st['graphic']),drawable=st['graphic']>=0 and st['mask'] in (0,2),color=deepcopy(st['color']),
                mask=int(st.get('mask') or 0),blend=st.get('blend'),filters=st.get('filters'),
                color_matrix=st.get('color_matrix')))
        if order is not None and seen!=order:raise DecodeError('Changing prop draw order')
        order=seen
        # Some bundles append auxiliary data after the final authored frame.
        # Intermediate offsets remain strict; the final frame must not overrun.
        if fi+1<frames and p!=end:raise DecodeError(f'Prop frame {fi} ends at {p}, expected {end}')
        result.append(snapshot)
    return {'frame_count':frames,'record_count':nodes,'format_flags':flags,'events':labels},result
