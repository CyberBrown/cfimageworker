//**
// * A Cloudflare Worker that intercepts image requests to resize and optimize them.
// *
// * How it works:
// * 1. It listens for all fetch requests to your website.
// * 2. It checks if the requested URL is for an image (ends with .jpg, .jpeg, .png, .gif).
// * 3. It parses image transformation options from the URL query string (e.g., ?width=800&quality=85).
// * 4. It detects if the browser supports modern image formats like AVIF and WebP by checking the 'Accept' header.
// * 5. It uses Cloudflare's built-in Image Resizing to fetch the original image and apply the transformations.
// * 6. It returns the newly optimized image to the user.
// * 7. It caches the transformed image at the edge for faster subsequent loads.
// */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const imageURL = url.searchParams.get('url');

 	  // Only process requests with a `url` query parameter, which should point to the image.
    // This helps to prevent the worker from trying to process non-image requests.
    if (!imageURL) {
      return new Response('Please provide an image URL in the `url` query parameter.', { status: 400 });
    }
    
    // Optional: Add a security check to ensure that requests are only for your own images.
    // This prevents others from using your worker as a free image resizing service.
    const allowedOrigin = `https://solampio.com`; // CHANGE THIS TO YOUR WEBSITE'S DOMAIN
    if (!imageURL.startsWith(allowedOrigin)) {
        return new Response('Not an allowed origin.', { status: 403 });
    }


    try {
      // Get the image from the origin
      const imageRequest = new Request(imageURL, {
        headers: request.headers,
      });

      // These are the default options for image transformations.
      const imageOptions = {
        cf: {
          image: {
            fit: 'scale-down',
            width: 800, // Default width if not specified in the URL
            quality: 85, // Default quality if not specified in the URL
            format: 'auto', // Automatically select the best format
          },
        },
      };
      
      // Look for custom image options in the query string and apply them.
      // e.g., ?url=...&width=300&height=300&quality=90&fit=cover
      const width = url.searchParams.get('width');
      if (width) {
        imageOptions.cf.image.width = parseInt(width, 10);
      }

      const height = url.searchParams.get('height');
      if (height) {
        imageOptions.cf.image.height = parseInt(height, 10);
      }

      const quality = url.searchParams.get('quality');
      if (quality) {
        imageOptions.cf.image.quality = parseInt(quality, 10);
      }
      
      const fit = url.searchParams.get('fit');
      if (fit && ['scale-down', 'contain', 'cover', 'crop', 'pad'].includes(fit)) {
        imageOptions.cf.image.fit = fit;
      }
      
      // Detect if the browser supports AVIF or WebP.
      const accept = request.headers.get('Accept');
      if (/image\/avif/.test(accept)) {
        imageOptions.cf.image.format = 'avif';
      } else if (/image\/webp/.test(accept)) {
        imageOptions.cf.image.format = 'webp';
      } else {
        imageOptions.cf.image.format = 'jpeg'; // Fallback for older browsers
      }


      // Fetch the image with the transformation options.
      const imageResponse = await fetch(imageRequest, imageOptions);

      // Clone the response to make it mutable.
      const newResponse = new Response(imageResponse.body, imageResponse);
      
      // Set a long cache time for the resized images.
      newResponse.headers.set('Cache-Control', 'public, max-age=31536000');

      return newResponse;

    } catch (error) {
      console.error(error);
      return new Response('Error processing image request.', { status: 500 });
    }
  },
};
