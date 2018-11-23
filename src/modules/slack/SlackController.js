import {
  SlackInteractiveMessage, SlackAttachment, SlackButtonAction, SlackCancelButtonAction
} from './SlackModels/SlackMessageModels';

class SlackController {
  static launch(req, res) {
    const message = SlackController.getWelcomeMessage();
    return res.status(200).json(message);
  }

  static getWelcomeMessage() {
    const attachment = new SlackAttachment('I am your trip operations assistant at Andela',
      'What would you like to do today?', 'Tembea', '', '');

    attachment.addActions([
      new SlackButtonAction('book', 'Schedule a Trip', 'book_new_trip'),
      new SlackButtonAction('view', 'See Trip Itinerary', 'view_open_trips'),
      new SlackButtonAction('view', 'See Available Routes', 'view_avilable_routes'),
      new SlackCancelButtonAction()
    ]);

    attachment.addOptionalProps('/fallback', 'welcome_message', '#3AA3E3', 'default');

    return new SlackInteractiveMessage('Welcome to Tembea!', [attachment]);
  }
}

export default SlackController;
