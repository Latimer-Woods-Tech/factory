import { Composition, registerRoot } from 'remotion';
import { MarketingVideo, marketingSchema } from './compositions/MarketingVideo';
import { TrainingVideo, trainingSchema } from './compositions/TrainingVideo';
import { WalkthroughVideo, walkthroughSchema } from './compositions/WalkthroughVideo';

export const VIDEO_FPS = 30;
export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;

/**
 * Remotion composition registry.
 * Each composition maps to a {@link RenderJobType} and is parameterised
 * by brand tokens resolved at render time.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MarketingVideo"
        component={MarketingVideo}
        durationInFrames={450}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={marketingSchema}
        defaultProps={{
          appId: 'prime_self',
          topic: 'Peak Performance',
          script: 'Raise your standard. Execute without compromise.',
          narrationUrl: '',
          brandColor: '#0066FF',
          brandAccent: '#FF6600',
          logoUrl: '',
        }}
      />

      <Composition
        id="TrainingVideo"
        component={TrainingVideo}
        durationInFrames={900}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={trainingSchema}
        defaultProps={{
          appId: 'prime_self',
          topic: 'Daily Discipline Protocol',
          script: 'This is your training protocol.',
          narrationUrl: '',
          brandColor: '#0066FF',
          brandAccent: '#FF6600',
          logoUrl: '',
          steps: ['Wake at 5am', 'Cold shower', 'Review goals', 'Execute the plan'],
        }}
      />

      <Composition
        id="WalkthroughVideo"
        component={WalkthroughVideo}
        durationInFrames={1200}
        fps={VIDEO_FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
        schema={walkthroughSchema}
        defaultProps={{
          appId: 'prime_self',
          topic: 'App Feature Walkthrough',
          script: 'Here is how to use this feature.',
          narrationUrl: '',
          brandColor: '#0066FF',
          brandAccent: '#FF6600',
          logoUrl: '',
          screenshotUrls: [],
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
