package com.offbit.zeal.subscription;

import com.offbit.zeal.events.ZipEvent;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Observable implementation for webhook events.
 */
public class WebhookObservable {
    private final WebhookSubscription subscription;
    private final List<Observer> observers = new CopyOnWriteArrayList<>();
    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread t = new Thread(r, "webhook-observable");
        t.setDaemon(true);
        return t;
    });

    public WebhookObservable(WebhookSubscription subscription) {
        this.subscription = subscription;
    }

    /**
     * Subscribe to events.
     */
    public Subscription subscribe(Consumer<ZipEvent> onNext) {
        return subscribe(onNext, null, null);
    }

    /**
     * Subscribe to events with error handling.
     */
    public Subscription subscribe(Consumer<ZipEvent> onNext, Consumer<Exception> onError) {
        return subscribe(onNext, onError, null);
    }

    /**
     * Subscribe to events with error handling and completion.
     */
    public Subscription subscribe(Consumer<ZipEvent> onNext, Consumer<Exception> onError, Runnable onComplete) {
        Observer observer = new Observer(onNext, onError, onComplete);
        observers.add(observer);
        
        return new Subscription() {
            @Override
            public void unsubscribe() {
                observers.remove(observer);
            }
            
            @Override
            public boolean isUnsubscribed() {
                return !observers.contains(observer);
            }
        };
    }

    /**
     * Filter events based on a predicate.
     */
    public WebhookObservable filter(Predicate<ZipEvent> predicate) {
        FilteredObservable filtered = new FilteredObservable(this, predicate);
        return filtered;
    }

    /**
     * Map events to a different type.
     */
    public <T> MappedObservable<T> map(Function<ZipEvent, T> mapper) {
        return new MappedObservable<>(this, mapper);
    }

    /**
     * Emit an event to all observers.
     */
    void emit(ZipEvent event) {
        for (Observer observer : observers) {
            executor.execute(() -> {
                try {
                    observer.onNext.accept(event);
                } catch (Exception e) {
                    if (observer.onError != null) {
                        observer.onError.accept(e);
                    }
                }
            });
        }
    }

    /**
     * Emit an error to all observers.
     */
    void error(Exception error) {
        for (Observer observer : observers) {
            if (observer.onError != null) {
                executor.execute(() -> observer.onError.accept(error));
            }
        }
    }

    /**
     * Complete all observers.
     */
    void complete() {
        for (Observer observer : observers) {
            if (observer.onComplete != null) {
                executor.execute(observer.onComplete);
            }
        }
        observers.clear();
    }

    /**
     * Observer holder.
     */
    private static class Observer {
        final Consumer<ZipEvent> onNext;
        final Consumer<Exception> onError;
        final Runnable onComplete;

        Observer(Consumer<ZipEvent> onNext, Consumer<Exception> onError, Runnable onComplete) {
            this.onNext = onNext;
            this.onError = onError;
            this.onComplete = onComplete;
        }
    }

    /**
     * Subscription interface.
     */
    public interface Subscription {
        void unsubscribe();
        boolean isUnsubscribed();
    }

    /**
     * Filtered observable.
     */
    static class FilteredObservable extends WebhookObservable {
        private final WebhookObservable source;
        private final Predicate<ZipEvent> predicate;
        private Subscription sourceSubscription;

        FilteredObservable(WebhookObservable source, Predicate<ZipEvent> predicate) {
            super(null);
            this.source = source;
            this.predicate = predicate;
            
            // Subscribe to source and filter events
            this.sourceSubscription = source.subscribe(
                event -> {
                    if (predicate.test(event)) {
                        emit(event);
                    }
                },
                this::error,
                this::complete
            );
        }
    }

    /**
     * Mapped observable.
     */
    public static class MappedObservable<T> {
        private final List<MappedObserver<T>> observers = new CopyOnWriteArrayList<>();
        private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "mapped-observable");
            t.setDaemon(true);
            return t;
        });

        MappedObservable(WebhookObservable source, Function<ZipEvent, T> mapper) {
            source.subscribe(
                event -> {
                    T mapped = mapper.apply(event);
                    emit(mapped);
                },
                this::error,
                this::complete
            );
        }

        public Subscription subscribe(Consumer<T> onNext) {
            return subscribe(onNext, null, null);
        }

        public Subscription subscribe(Consumer<T> onNext, Consumer<Exception> onError, Runnable onComplete) {
            MappedObserver<T> observer = new MappedObserver<>(onNext, onError, onComplete);
            observers.add(observer);
            
            return new Subscription() {
                @Override
                public void unsubscribe() {
                    observers.remove(observer);
                }
                
                @Override
                public boolean isUnsubscribed() {
                    return !observers.contains(observer);
                }
            };
        }

        void emit(T value) {
            for (MappedObserver<T> observer : observers) {
                executor.execute(() -> {
                    try {
                        observer.onNext.accept(value);
                    } catch (Exception e) {
                        if (observer.onError != null) {
                            observer.onError.accept(e);
                        }
                    }
                });
            }
        }

        void error(Exception error) {
            for (MappedObserver<T> observer : observers) {
                if (observer.onError != null) {
                    executor.execute(() -> observer.onError.accept(error));
                }
            }
        }

        void complete() {
            for (MappedObserver<T> observer : observers) {
                if (observer.onComplete != null) {
                    executor.execute(observer.onComplete);
                }
            }
            observers.clear();
        }

        static class MappedObserver<T> {
            final Consumer<T> onNext;
            final Consumer<Exception> onError;
            final Runnable onComplete;

            MappedObserver(Consumer<T> onNext, Consumer<Exception> onError, Runnable onComplete) {
                this.onNext = onNext;
                this.onError = onError;
                this.onComplete = onComplete;
            }
        }
    }
}