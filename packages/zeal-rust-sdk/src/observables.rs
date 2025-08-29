//! Observable stream extensions for event processing

use futures_util::Stream;
use std::pin::Pin;
use std::task::{Context, Poll};

/// Extension trait for observable streams
pub trait ZealObservable<T>: Stream<Item = T> + Sized {
    /// Filter items based on a predicate
    fn filter<F>(self, predicate: F) -> FilterStream<Self, F>
    where
        F: FnMut(&T) -> bool,
    {
        FilterStream {
            stream: self,
            predicate,
        }
    }
}

impl<S, T> ZealObservable<T> for S where S: Stream<Item = T> {}

/// Alias for the main observable extension trait
pub use ZealObservable as ObservableExt;

/// Stream that filters items
#[pin_project::pin_project]
pub struct FilterStream<S, F> {
    #[pin]
    stream: S,
    predicate: F,
}

impl<S, F, T> Stream for FilterStream<S, F>
where
    S: Stream<Item = T>,
    F: FnMut(&T) -> bool,
{
    type Item = T;

    fn poll_next(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        let mut this = self.project();
        
        loop {
            match this.stream.as_mut().poll_next(cx) {
                Poll::Ready(Some(item)) => {
                    if (this.predicate)(&item) {
                        return Poll::Ready(Some(item));
                    }
                    // Continue to next item if predicate failed
                }
                Poll::Ready(None) => return Poll::Ready(None),
                Poll::Pending => return Poll::Pending,
            }
        }
    }
}