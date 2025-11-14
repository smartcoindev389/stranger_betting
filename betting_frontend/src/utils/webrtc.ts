let localStream: MediaStream | null = null;
let peerConnection: RTCPeerConnection | null = null;

const configuration: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export const startVideo = async (): Promise<MediaStream> => {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    return localStream;
  } catch (error) {
    console.error('Error accessing media devices:', error);
    throw error;
  }
};

export const stopVideo = () => {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop());
    localStream = null;
  }
};

export const createPeerConnection = (): RTCPeerConnection => {
  peerConnection = new RTCPeerConnection(configuration);

  if (localStream) {
    localStream.getTracks().forEach((track) => {
      peerConnection?.addTrack(track, localStream!);
    });
  }

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      console.log('New ICE candidate:', event.candidate);
    }
  };

  peerConnection.ontrack = (event) => {
    console.log('Remote track received:', event.streams[0]);
  };

  return peerConnection;
};

export const createOffer = async (): Promise<RTCSessionDescriptionInit> => {
  if (!peerConnection) {
    throw new Error('Peer connection not initialized');
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  return offer;
};

export const createAnswer = async (
  offer: RTCSessionDescriptionInit
): Promise<RTCSessionDescriptionInit> => {
  if (!peerConnection) {
    throw new Error('Peer connection not initialized');
  }

  await peerConnection.setRemoteDescription(offer);
  const answer = await peerConnection.createAnswer();
  await peerConnection.setLocalDescription(answer);
  return answer;
};

export const setRemoteDescription = async (answer: RTCSessionDescriptionInit) => {
  if (!peerConnection) {
    throw new Error('Peer connection not initialized');
  }

  await peerConnection.setRemoteDescription(answer);
};

export const addIceCandidate = async (candidate: RTCIceCandidateInit) => {
  if (!peerConnection) {
    throw new Error('Peer connection not initialized');
  }

  await peerConnection.addIceCandidate(candidate);
};

export const closePeerConnection = () => {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  stopVideo();
};

export const toggleAudio = (enabled: boolean) => {
  if (localStream) {
    localStream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
};

export const toggleVideoTrack = (enabled: boolean) => {
  if (localStream) {
    localStream.getVideoTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
};

export const getLocalStream = (): MediaStream | null => {
  return localStream;
};
