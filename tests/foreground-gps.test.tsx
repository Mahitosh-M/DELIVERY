import {it,expect,vi,afterEach} from 'vitest';
import {renderHook,act} from '@testing-library/react';
import {useForegroundPosition} from '../src/use-foreground-position';
afterEach(()=>vi.unstubAllGlobals());
it('clears GPS when paused or unmounted; late callbacks are ignored',()=>{
 let success:PositionCallback=()=>{},failure:PositionErrorCallback=()=>{};
 const clearWatch=vi.fn(),watchPosition=vi.fn((yes:PositionCallback,no:PositionErrorCallback)=>{success=yes;failure=no;return 42;});
 vi.stubGlobal('navigator',{geolocation:{watchPosition,clearWatch}});
 const {result,rerender,unmount}=renderHook(({enabled})=>useForegroundPosition(enabled),{initialProps:{enabled:false}});
 expect(watchPosition).not.toHaveBeenCalled();rerender({enabled:true});act(()=>success({coords:{latitude:15,longitude:76}} as GeolocationPosition));expect(result.current.position).toEqual({lat:15,lng:76});
 act(()=>failure({code:1} as GeolocationPositionError));expect(result.current.error).toContain('permission denied');expect(result.current.position).toBeNull();
 rerender({enabled:false});expect(clearWatch).toHaveBeenCalledWith(42);act(()=>success({coords:{latitude:0,longitude:0}} as GeolocationPosition));expect(result.current.position).toBeNull();
 rerender({enabled:true});unmount();expect(clearWatch).toHaveBeenCalledTimes(2);
});
it('handles devices without location',()=>{
 vi.stubGlobal('navigator',{});const {result}=renderHook(()=>useForegroundPosition(true));expect(result.current.error).toContain('unavailable');expect(result.current.position).toBeNull();
});
